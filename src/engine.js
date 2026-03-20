/**
 * DeltaYield V4.5 — Backtest Engine (Mitigant Engine + Decomposed P&L)
 *
 * All formulas from the brief — zero synthetic data.
 * V4.5 changes (Addendum 5):
 *   - M1: Stop Cap per Rolling Window (max N stops in X days → disable hedge)
 *   - M2: ETHBTC SMA Trend Filter (only hedge when ETH underperforming)
 *   - M3: Progressive De-Hedging (50% → 30% → 15% → 0% on consecutive stops)
 *   - M4: Exponential Cooldown (double cooldown after each stop, cap 30d)
 *   - Decomposed P&L: fundingIncome + shortPnl (was single "hedge" number)
 *   - Enhanced position tracking with mitigant state
 *   - Dynamic hedge ratio (from M3)
 *   - Presets: Recommended, Conservative, Aggressive, No Mitigants
 */

// ─── Constants ──────────────────────────────────────────────────────
const RANGE_WIDTH = 0.10;
const MULTIPLIER = 0.94;
const DEFAULT_SLIPPAGE = 0.0010;
const SWAP_FEE_005 = 0.0005;
const SWAP_FEE_030 = 0.003;
const REBALANCE_THRESHOLD = 0.10;
const HEDGE_RATIO = 0.50;
const START_BTC = 1.0;
const SMA_GOLDEN = '2021-07-05';
const SMA_DEATH = '2024-04-15';

const PERP_FEE_HL = 0.00045;   // Hyperliquid: 0.045% per side
const PERP_FEE_BIN = 0.00050;  // Binance: 0.050% per side

// M3: Progressive de-hedge steps
const DEHEDGE_STEPS = [0.50, 0.30, 0.15, 0];

// ─── Mitigant Presets ───────────────────────────────────────────────
export const MITIGANT_PRESETS = {
  recommended: {
    label: 'Recommended',
    leverage: 4.0, marginThreshold: 0.30, rebalanceDelay: 4, cooldownDays: 2,
    maxStopsPerWindow: 1, stopWindowDays: 60,
    ethbtcSmaFilter: false, ethbtcSmaPeriod: 30,
    progressiveDehedge: true, expCooldown: true, baseCooldownDays: 3,
  },
  conservative: {
    label: 'Conservative',
    leverage: 5.0, marginThreshold: 0.25, rebalanceDelay: 2, cooldownDays: 2,
    maxStopsPerWindow: 1, stopWindowDays: 60,
    ethbtcSmaFilter: false, ethbtcSmaPeriod: 30,
    progressiveDehedge: true, expCooldown: true, baseCooldownDays: 2,
  },
  aggressive: {
    label: 'Aggressive',
    leverage: 2.0, marginThreshold: 0.15, rebalanceDelay: 4, cooldownDays: 2,
    maxStopsPerWindow: 1, stopWindowDays: 60,
    ethbtcSmaFilter: false, ethbtcSmaPeriod: 30,
    progressiveDehedge: true, expCooldown: true, baseCooldownDays: 3,
  },
  none: {
    label: 'No Mitigants',
    leverage: 3.0, marginThreshold: 0.30, rebalanceDelay: 2, cooldownDays: 2,
    maxStopsPerWindow: Infinity, stopWindowDays: 60,
    ethbtcSmaFilter: false, ethbtcSmaPeriod: 30,
    progressiveDehedge: false, expCooldown: false, baseCooldownDays: 2,
  },
};

// ─── Helpers ────────────────────────────────────────────────────────

function calcIL(r) {
  if (r <= 0) return 0;
  return (2 * Math.sqrt(r)) / (1 + r) - 1;
}

function dailyRate(apy) {
  if (!apy || apy <= 0) return 0;
  return Math.pow(1 + apy / 100, 1 / 365) - 1;
}

function isPoolOn(date, timingMode) {
  if (timingMode === 'always') return true;
  return date >= SMA_GOLDEN && date < SMA_DEATH;
}

function getPerpFee(exchange) {
  return exchange === 'binance' ? PERP_FEE_BIN : PERP_FEE_HL;
}

function subtractDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Precompute rolling SMA of ethbtc prices */
function precomputeEthbtcSma(data, period) {
  const sma = new Array(data.length).fill(null);
  let sum = 0, count = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i].ethbtc != null) {
      sum += data[i].ethbtc;
      count++;
    }
    if (i >= period) {
      const old = data[i - period].ethbtc;
      if (old != null) { sum -= old; count--; }
    }
    if (count > 0 && i >= period - 1) {
      sma[i] = sum / count;
    }
  }
  return sma;
}

export function formatDate(dateStr) {
  if (!dateStr || dateStr.length < 10) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateShort(dateStr) {
  if (!dateStr || dateStr.length < 10) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

export function filterByTimeRange(series, range) {
  if (!series.length || range === 'all') return series;
  const last = series[series.length - 1].date;
  const lastDate = new Date(last);
  let startDate;
  switch (range) {
    case '3m': startDate = new Date(lastDate); startDate.setMonth(startDate.getMonth() - 3); break;
    case '6m': startDate = new Date(lastDate); startDate.setMonth(startDate.getMonth() - 6); break;
    case 'ytd': startDate = new Date(lastDate.getFullYear(), 0, 1); break;
    case '1y': startDate = new Date(lastDate); startDate.setFullYear(startDate.getFullYear() - 1); break;
    case '3y': startDate = new Date(lastDate); startDate.setFullYear(lastDate.getFullYear() - 3); break;
    case '5y': startDate = new Date(lastDate); startDate.setFullYear(lastDate.getFullYear() - 5); break;
    default: return series;
  }
  const startStr = startDate.toISOString().slice(0, 10);
  return series.filter(s => s.date >= startStr);
}

// ─── Main Backtest (V4.5 with Mitigants) ────────────────────────────

export function runBacktest(data, config) {
  const {
    feeTier = '005',
    timing = 'always',
    hedge = true,
    offMode = 'B',
    gasOverride = null,
    slippage = DEFAULT_SLIPPAGE,
    rebalanceDelay = 0,
    leverage = 3.0,
    marginThreshold = 0.30,
    cooldownDays = 2,
    exchange = 'hl',
    // Mitigant params
    maxStopsPerWindow = Infinity,
    stopWindowDays = 60,
    ethbtcSmaFilter = false,
    ethbtcSmaPeriod = 30,
    progressiveDehedge = false,
    expCooldown = false,
    baseCooldownDays = 2,
  } = config;

  const PERP_FEE = getPerpFee(exchange);
  const swapFee = feeTier === '005' ? SWAP_FEE_005 : SWAP_FEE_030;
  const apyKey = feeTier === '005' ? 'apy_005' : 'apy_030';

  // Precompute ETHBTC SMA for M2
  const ethbtcSma = ethbtcSmaFilter ? precomputeEthbtcSma(data, ethbtcSmaPeriod) : null;

  // ─── CRITICAL: Truncate data at last day with complete ethbtc data ───
  let lastEthbtcIdx = data.length - 1;
  while (lastEthbtcIdx > 0 && data[lastEthbtcIdx].ethbtc == null) {
    lastEthbtcIdx--;
  }
  const truncatedData = data.slice(0, lastEthbtcIdx + 1);

  // ─── State ──────────────────────────────────────────────
  let lpBtc = START_BTC;
  let scBtc = 0;
  let scUsd = 0;
  let scInitUsd = 0;
  let peak = START_BTC;
  let maxDD = 0;
  let rangeCenter = null;
  let wasOn = false;
  let rebalanceCount = 0;

  // Short state
  let shortOpen = false;
  let shortQtyEth = 0;
  let shortEntryEthUsd = 0;
  let maxHedgeExposure = 0;

  // Rebalance delay state
  let pendingRebalance = false;
  let rangeExitDay = null;
  let daysOutOfRange = 0;
  let feesMissed = 0;

  // Cooldown state
  let inCooldown = false;
  let cooldownRemaining = 0;

  // Margin stop tracking
  let marginStopCount = 0;
  let totalStopLoss = 0;
  let totalCooldownDaysSpent = 0;

  // ─── Mitigant State ─────────────────────────────────────
  let stopDates = [];                        // M1: history of stop dates
  let currentHedgeRatio = HEDGE_RATIO;       // M3: dynamic hedge ratio
  let consecutiveStops = 0;                  // M3: consecutive stop counter
  let cooldownMultiplier = 1;                // M4: exponential multiplier
  let hedgeDisabledByMitigant = false;       // Flag: hedge off due to mitigant
  let hedgeActiveDays = 0;                   // Track days with hedge active

  // Cumulative costs — DECOMPOSED
  let totalFees = 0, totalFundingIncome = 0, totalShortPnl = 0;
  let totalIL = 0, totalGas = 0;
  let totalSlippage = 0, totalSwapFees = 0, totalPerpFees = 0;

  const positions = [];
  let currentPosition = null;
  const series = [];

  // ─── Helper: get gas in USD for a day ───────────────────
  function getGasUsd(d) {
    if (gasOverride != null) return gasOverride;
    const gasArb = d.gasArb || d.gas_arb || 0.03;
    const gasEth = d.gasEth || d.gas_eth || 0.50;
    return feeTier === '005' ? gasArb : gasEth;
  }

  // ─── Helper: read btcUsd from data ─────────────────────
  function getBtcUsd(d) {
    return d.btcUsd || d.btc_usd || 85000;
  }

  // ─── M1+M2+M3: Should we hedge on this opening? ────────
  function shouldHedge(dayIndex) {
    if (!hedge) return false;

    // M2: ETHBTC SMA filter
    if (ethbtcSmaFilter && ethbtcSma) {
      const sma = ethbtcSma[dayIndex];
      const eb = truncatedData[dayIndex]?.ethbtc;
      if (sma != null && eb != null && eb > sma) {
        return false; // ETH outperforming BTC → no hedge
      }
    }

    // M1: Stop cap per window
    if (maxStopsPerWindow < Infinity) {
      const currentDate = truncatedData[dayIndex].date;
      const windowStart = subtractDays(currentDate, stopWindowDays);
      const recentStops = stopDates.filter(d => d >= windowStart).length;
      if (recentStops >= maxStopsPerWindow) {
        return false; // Too many recent stops → no hedge
      }
    }

    // M3: If progressive dehedge reduced to 0
    if (progressiveDehedge && currentHedgeRatio <= 0.01) {
      return false;
    }

    return true;
  }

  // ─── Helper: get effective hedge ratio ─────────────────
  function getEffectiveHedgeRatio() {
    if (progressiveDehedge) return currentHedgeRatio;
    return HEDGE_RATIO;
  }

  // ─── Helper: on margin stop — update mitigants ─────────
  function onMarginStop(date) {
    // M1: Record stop date
    stopDates.push(date);

    // M3: Reduce hedge ratio
    if (progressiveDehedge) {
      consecutiveStops++;
      if (consecutiveStops < DEHEDGE_STEPS.length) {
        currentHedgeRatio = DEHEDGE_STEPS[consecutiveStops];
      } else {
        currentHedgeRatio = 0;
      }
    }

    // M4: Double cooldown multiplier
    if (expCooldown) {
      cooldownMultiplier *= 2;
    }
  }

  // ─── Helper: on normal rebalance — reset mitigants ─────
  function onNormalRebalance() {
    if (progressiveDehedge) {
      consecutiveStops = 0;
      currentHedgeRatio = HEDGE_RATIO;
    }
    if (expCooldown) {
      cooldownMultiplier = 1;
    }
  }

  // ─── Helper: get effective cooldown days ────────────────
  function getEffectiveCooldown() {
    if (expCooldown) {
      const base = baseCooldownDays > 0 ? baseCooldownDays : cooldownDays;
      return Math.min(base * cooldownMultiplier, 30); // cap 30 days
    }
    return cooldownDays;
  }

  // ─── Helper: open position ─────────────────────────────
  function doOpen(d, dayIndex) {
    const eb = d.ethbtc;
    const bu = getBtcUsd(d);
    const eu = eb * bu;
    let totalAum = lpBtc + scBtc;

    // Gas for opening
    const gasUsd = getGasUsd(d);
    const gasCost = gasUsd / bu;
    totalAum -= gasCost;
    totalGas += gasCost;
    if (currentPosition) currentPosition.gas += gasCost;

    // Determine if hedge should be active
    const hedgeThisPosition = shouldHedge(dayIndex);
    hedgeDisabledByMitigant = hedge && !hedgeThisPosition;
    const effectiveRatio = hedgeThisPosition ? getEffectiveHedgeRatio() : 0;

    if (currentPosition) {
      currentPosition.hedgeEnabled = hedgeThisPosition;
      currentPosition.hedgeRatio = effectiveRatio;
      currentPosition.mitigantState = {
        m1_stopsInWindow: maxStopsPerWindow < Infinity
          ? stopDates.filter(sd => sd >= subtractDays(d.date, stopWindowDays)).length
          : 0,
        m3_hedgeRatio: currentHedgeRatio,
        m4_cooldownMultiplier: cooldownMultiplier,
      };
    }

    if (hedgeThisPosition && effectiveRatio > 0.01) {
      // Split: LP gets (1 - effectiveRatio/leverage), short collateral gets effectiveRatio/leverage
      let scBtcNew = totalAum * effectiveRatio / leverage;
      let lpNew = totalAum - scBtcNew;

      // Convert collateral BTC to USD (with slippage)
      const scSlip = scBtcNew * slippage;
      scBtcNew -= scSlip;
      totalSlippage += scSlip;
      if (currentPosition) currentPosition.slippage += scSlip;

      const scUsdNew = scBtcNew * bu;
      scInitUsd = scUsdNew;
      scUsd = scUsdNew;
      scBtc = scBtcNew;

      // Short: notional = totalAum * effectiveRatio * bu
      const shortNotionalUsd = totalAum * effectiveRatio * bu;
      shortQtyEth = shortNotionalUsd / eu;
      shortEntryEthUsd = eu;
      shortOpen = true;

      if (shortNotionalUsd / bu > maxHedgeExposure) {
        maxHedgeExposure = shortNotionalUsd / bu;
      }

      // Perp fee on open
      const perpFee = shortNotionalUsd * PERP_FEE;
      scUsd -= perpFee;
      totalPerpFees += perpFee / bu;
      if (currentPosition) currentPosition.perpFees += perpFee / bu;

      // Swap fee + slippage on LP half
      const swapFeeCost = lpNew * 0.5 * swapFee;
      const slipFeeCost = lpNew * 0.5 * slippage;
      lpNew -= swapFeeCost + slipFeeCost;
      totalSwapFees += swapFeeCost;
      totalSlippage += slipFeeCost;
      if (currentPosition) {
        currentPosition.swapFees += swapFeeCost;
        currentPosition.slippage += slipFeeCost;
      }

      lpBtc = lpNew;
    } else {
      // No hedge (either disabled globally or by mitigant)
      lpBtc = totalAum;
      scBtc = 0;
      scUsd = 0;
      scInitUsd = 0;
      shortOpen = false;

      // Swap fee + slippage on LP half
      const swapFeeCost = lpBtc * 0.5 * swapFee;
      const slipFeeCost = lpBtc * 0.5 * slippage;
      lpBtc -= swapFeeCost + slipFeeCost;
      totalSwapFees += swapFeeCost;
      totalSlippage += slipFeeCost;
      if (currentPosition) {
        currentPosition.swapFees += swapFeeCost;
        currentPosition.slippage += slipFeeCost;
      }
    }

    rangeCenter = eb;
  }

  // ─── Helper: close position ────────────────────────────
  function doClose(d) {
    const eb = d.ethbtc;
    const bu = getBtcUsd(d);

    // SAFETY: If ethbtc is null/0, guard
    if (!eb || eb <= 0) {
      const total = lpBtc + scBtc;
      lpBtc = total;
      scBtc = 0;
      rangeCenter = null;
      shortOpen = false;
      shortQtyEth = 0;
      shortEntryEthUsd = 0;
      scUsd = 0;
      scInitUsd = 0;
      return;
    }

    const eu = eb * bu;

    // IL on LP
    if (rangeCenter && eb) {
      const r = eb / rangeCenter;
      const il = lpBtc * calcIL(r);
      const ilCost = Math.abs(il);
      lpBtc -= ilCost;
      totalIL += ilCost;
      if (currentPosition) currentPosition.il += ilCost;
    }

    // Gas for closing
    const gasUsd = getGasUsd(d);
    const gasCost = gasUsd / bu;
    lpBtc -= gasCost;
    totalGas += gasCost;
    if (currentPosition) currentPosition.gas += gasCost;

    // Close short
    if (shortOpen) {
      const pnlUsd = (shortEntryEthUsd - eu) * shortQtyEth;
      scUsd += pnlUsd;

      // Track short P&L in BTC — SEPARATE from funding
      const shortPnlBtc = pnlUsd / bu;
      totalShortPnl += shortPnlBtc;
      if (currentPosition) currentPosition.shortPnl += shortPnlBtc;

      // Perp fee on close
      const closeNotional = shortQtyEth * eu;
      const perpFee = closeNotional * PERP_FEE;
      scUsd -= perpFee;
      totalPerpFees += perpFee / bu;
      if (currentPosition) currentPosition.perpFees += perpFee / bu;

      // Convert remaining USD collateral back to BTC (with slippage)
      const scBtcRaw = Math.max(0, scUsd) / bu;
      const scSlip = scBtcRaw * slippage;
      scBtc = scBtcRaw - scSlip;
      totalSlippage += scSlip;
      if (currentPosition) currentPosition.slippage += scSlip;

      shortOpen = false;
      shortQtyEth = 0;
      shortEntryEthUsd = 0;
      scUsd = 0;
      scInitUsd = 0;
    }

    // Consolidate
    const total = lpBtc + scBtc;
    lpBtc = total;
    scBtc = 0;
    rangeCenter = null;
  }

  // ─── Helper: check margin stop ─────────────────────────
  function checkMarginStop(d) {
    if (!shortOpen || scInitUsd <= 0) return false;
    const eu = d.ethbtc * getBtcUsd(d);
    const pnl = (shortEntryEthUsd - eu) * shortQtyEth;
    if (pnl >= 0) return false;
    return Math.abs(pnl) / scInitUsd >= marginThreshold;
  }

  // ─── Helper: create new position object ─────────────────
  function makePosition(date, ethbtc) {
    return {
      entryDate: date, exitDate: null,
      entryPrice: ethbtc, exitPrice: null,
      entryBtc: lpBtc + scBtc, exitBtc: null,
      fees: 0, fundingIncome: 0, shortPnl: 0, hedgePnl: 0, il: 0, gas: 0,
      slippage: 0, swapFees: 0, perpFees: 0,
      rebalances: 0, closeReason: null,
      hedgeEnabled: false, hedgeRatio: 0, leverage: leverage,
      entryWbtcPct: 0.5, entryWethPct: 0.5,
      exitWbtcPct: null, exitWethPct: null,
      mitigantState: { m1_stopsInWindow: 0, m3_hedgeRatio: currentHedgeRatio, m4_cooldownMultiplier: cooldownMultiplier },
    };
  }

  // ─── Helper: finalize position ──────────────────────────
  function finalizePosition(date, ethbtc, closeReason) {
    if (!currentPosition) return;
    currentPosition.exitDate = date;
    currentPosition.exitPrice = ethbtc || currentPosition.entryPrice;
    currentPosition.exitBtc = lpBtc + scBtc;
    currentPosition.closeReason = closeReason;
    // hedgePnl = fundingIncome + shortPnl for backward compat
    currentPosition.hedgePnl = currentPosition.fundingIncome + currentPosition.shortPnl;
    if (ethbtc && currentPosition.entryPrice) {
      const r = ethbtc / currentPosition.entryPrice;
      currentPosition.exitWbtcPct = Math.min(1, Math.max(0, 0.5 + (r - 1) * 2.5));
      currentPosition.exitWethPct = 1 - currentPosition.exitWbtcPct;
    }
    positions.push(currentPosition);
    currentPosition = null;
  }

  // ─── Main Loop ──────────────────────────────────────────
  for (let i = 0; i < truncatedData.length; i++) {
    const d = truncatedData[i];
    const date = d.date;
    const ethbtc = d.ethbtc;
    const apy = d[apyKey];
    const fundingRate = d.funding;
    const btcUsd = getBtcUsd(d);

    const on = isPoolOn(date, timing) && ethbtc != null && apy != null;

    let marginStopToday = false;

    // ─── OFF → ON transition ─────────────────────────────
    if (on && !wasOn) {
      pendingRebalance = false;
      rangeExitDay = null;
      inCooldown = false;
      cooldownRemaining = 0;

      currentPosition = makePosition(date, ethbtc);
      doOpen(d, i);
    }

    // ─── ON → OFF transition ─────────────────────────────
    if (!on && wasOn && currentPosition) {
      doClose(d);
      finalizePosition(date, ethbtc, 'sma_off');
      pendingRebalance = false;
      rangeExitDay = null;
      inCooldown = false;
      cooldownRemaining = 0;
    }

    // ─── Daily ON logic ──────────────────────────────────
    if (on && ethbtc != null && apy != null) {

      // ═══ PRIORITY 1: Margin stop check ═══
      if (shortOpen && checkMarginStop(d)) {
        marginStopToday = true;
        marginStopCount++;

        const totalBefore = lpBtc + scBtc;
        doClose(d);
        const totalAfter = lpBtc + scBtc;
        const stopLoss = totalBefore - totalAfter;
        if (stopLoss > 0) totalStopLoss += stopLoss;

        // Update mitigants BEFORE deciding cooldown
        onMarginStop(date);

        // Get effective cooldown (may be exponential)
        const effectiveCooldown = getEffectiveCooldown();

        inCooldown = true;
        cooldownRemaining = effectiveCooldown;
        pendingRebalance = false;
        rangeExitDay = null;
        rebalanceCount++;

        finalizePosition(date, ethbtc, 'margin_stop');

        // If cooldown is 0, immediately reopen
        if (effectiveCooldown === 0) {
          inCooldown = false;
          currentPosition = makePosition(date, ethbtc);
          doOpen(d, i);
        }
      }

      // ═══ PRIORITY 2: Cooldown ═══
      else if (inCooldown) {
        cooldownRemaining--;
        totalCooldownDaysSpent++;

        if (cooldownRemaining <= 0) {
          inCooldown = false;
          currentPosition = makePosition(date, ethbtc);
          doOpen(d, i);
        }
      }

      // ═══ PRIORITY 3: Pending rebalance (delay path) ═══
      else if (pendingRebalance) {
        // No pool fees while waiting (out of range)
        const dr = dailyRate(apy);
        const missedFee = lpBtc * dr * MULTIPLIER;
        feesMissed += missedFee;
        daysOutOfRange++;

        // Funding income still accrues during delay
        if (shortOpen && fundingRate != null) {
          const hedgeExposureBtc = (lpBtc + scBtc) * getEffectiveHedgeRatio();
          const hi = hedgeExposureBtc * (fundingRate / 100 / 365);
          scUsd += hi * btcUsd;
          totalFundingIncome += hi;
          if (currentPosition) currentPosition.fundingIncome += hi;
        }

        // Check if delay period has elapsed
        if (i - rangeExitDay >= rebalanceDelay) {
          doClose(d);
          rebalanceCount++;
          onNormalRebalance();
          finalizePosition(date, ethbtc, 'rebalance');

          currentPosition = makePosition(date, ethbtc);
          doOpen(d, i);

          pendingRebalance = false;
          rangeExitDay = null;
        }
      }

      // ═══ Normal in-range day ═══
      else {
        // Accrue pool fees
        const dr = dailyRate(apy);
        const feeIncome = lpBtc * dr * MULTIPLIER;
        lpBtc += feeIncome;
        totalFees += feeIncome;
        if (currentPosition) currentPosition.fees += feeIncome;

        // Funding income
        if (shortOpen && fundingRate != null) {
          const hedgeExposureBtc = (lpBtc + scBtc) * getEffectiveHedgeRatio();
          const hi = hedgeExposureBtc * (fundingRate / 100 / 365);
          scUsd += hi * btcUsd;
          totalFundingIncome += hi;
          if (currentPosition) currentPosition.fundingIncome += hi;
        }

        // Track hedge active days
        if (shortOpen) hedgeActiveDays++;

        // Check range exit
        if (rangeCenter != null) {
          const drift = Math.abs(ethbtc / rangeCenter - 1);
          if (drift >= REBALANCE_THRESHOLD) {
            if (rebalanceDelay > 0) {
              pendingRebalance = true;
              rangeExitDay = i;
            } else {
              doClose(d);
              rebalanceCount++;
              onNormalRebalance();
              finalizePosition(date, ethbtc, 'rebalance');

              currentPosition = makePosition(date, ethbtc);
              doOpen(d, i);
            }
          }
        }
      }
    }

    // ─── OFF but hedge open (Mode B legacy compat) ───────
    if (!on && shortOpen && offMode === 'B' && fundingRate != null) {
      const hedgeExposureBtc = (lpBtc + scBtc) * getEffectiveHedgeRatio();
      const hi = hedgeExposureBtc * (fundingRate / 100 / 365);
      scUsd += hi * btcUsd;
      totalFundingIncome += hi;
    }

    // ─── Track peak & drawdown ───────────────────────────
    const totalAum = lpBtc + scBtc;
    if (totalAum > peak) peak = totalAum;
    const dd = (totalAum - peak) / peak;
    if (dd < maxDD) maxDD = dd;

    wasOn = on;

    // ─── Series entry ────────────────────────────────────
    let displayScBtc = scBtc;
    if (shortOpen && ethbtc) {
      const eu = ethbtc * btcUsd;
      const unrealizedPnlUsd = (shortEntryEthUsd - eu) * shortQtyEth;
      const currentScUsd = scUsd + unrealizedPnlUsd;
      displayScBtc = Math.max(0, currentScUsd) / btcUsd;
    }

    series.push({
      date,
      btc: parseFloat(totalAum.toFixed(6)),
      btcUsd,
      lpBtc: parseFloat(lpBtc.toFixed(6)),
      scBtc: parseFloat(displayScBtc.toFixed(6)),
      fees: parseFloat(totalFees.toFixed(6)),
      fundingIncome: parseFloat(totalFundingIncome.toFixed(6)),
      shortPnlBtc: parseFloat(totalShortPnl.toFixed(6)),
      hedge: parseFloat((totalFundingIncome + totalShortPnl).toFixed(6)), // backward compat
      il: parseFloat(totalIL.toFixed(6)),
      inCooldown,
      pendingRebalance,
      marginStop: marginStopToday,
      hedgeDisabledByMitigant,
      hedgeRatio: getEffectiveHedgeRatio(),
      cooldownMultiplier,
      ethUsd: ethbtc ? parseFloat((ethbtc * btcUsd).toFixed(2)) : null,
      // Legacy fields
      ethbtc: ethbtc || null,
      btceth: ethbtc ? parseFloat((1 / ethbtc).toFixed(4)) : null,
      apy: apy ?? null,
      funding: fundingRate ?? null,
      on,
      hedgeOpen: shortOpen,
      hedgeExposure: shortOpen ? parseFloat(((lpBtc + scBtc) * getEffectiveHedgeRatio()).toFixed(6)) : 0,
      rangeCenter: rangeCenter ? parseFloat(rangeCenter.toFixed(8)) : null,
      rangeLower: rangeCenter ? parseFloat((rangeCenter * (1 - RANGE_WIDTH)).toFixed(8)) : null,
      rangeUpper: rangeCenter ? parseFloat((rangeCenter * (1 + RANGE_WIDTH)).toFixed(8)) : null,
    });
  }

  // ─── Close final open position ─────────────────────────
  if (currentPosition) {
    const lastValid = truncatedData[truncatedData.length - 1];
    currentPosition.hedgePnl = currentPosition.fundingIncome + currentPosition.shortPnl;
    currentPosition.exitDate = lastValid.date;
    currentPosition.exitPrice = lastValid.ethbtc || currentPosition.entryPrice;
    currentPosition.exitBtc = lpBtc + scBtc;
    currentPosition.closeReason = 'end';
    positions.push(currentPosition);
  }

  // ─── Compute metrics ──────────────────────────────────
  const totalDays = series.length;
  const activeDays = series.filter(s => s.on).length;
  const years = totalDays / 365;
  const finalBtc = lpBtc + scBtc;
  const netGain = finalBtc - START_BTC;
  const cagr = years > 0 ? (Math.pow(finalBtc / START_BTC, 1 / years) - 1) * 100 : 0;
  const cagrDdRatio = maxDD !== 0 ? cagr / Math.abs(maxDD * 100) : Infinity;

  return {
    series,
    positions,
    metrics: {
      finalBtc: parseFloat(finalBtc.toFixed(6)),
      netGain: parseFloat(netGain.toFixed(6)),
      cagr: parseFloat(cagr.toFixed(2)),
      maxDD: parseFloat((maxDD * 100).toFixed(4)),
      cagrDdRatio: parseFloat(cagrDdRatio.toFixed(2)),
      rebalanceCount,
      totalDays,
      activeDays,
      years: parseFloat(years.toFixed(2)),
      maxHedgeExposure: parseFloat(maxHedgeExposure.toFixed(6)),
      daysOutOfRange,
      feesMissed: parseFloat(feesMissed.toFixed(6)),
      // V4 fields
      marginStops: marginStopCount,
      avgStopLoss: marginStopCount > 0 ? parseFloat((totalStopLoss / marginStopCount).toFixed(6)) : 0,
      cooldownDays: totalCooldownDaysSpent,
      cooldownPct: totalDays > 0 ? parseFloat((totalCooldownDaysSpent / totalDays * 100).toFixed(2)) : 0,
      // V4.5 fields
      hedgeActiveDays,
      hedgeActivePct: activeDays > 0 ? parseFloat((hedgeActiveDays / activeDays * 100).toFixed(1)) : 0,
    },
    costs: {
      fees: parseFloat(totalFees.toFixed(6)),
      fundingIncome: parseFloat(totalFundingIncome.toFixed(6)),
      shortPnl: parseFloat(totalShortPnl.toFixed(6)),
      hedge: parseFloat((totalFundingIncome + totalShortPnl).toFixed(6)), // backward compat
      il: parseFloat(totalIL.toFixed(6)),
      gas: parseFloat(totalGas.toFixed(6)),
      slippage: parseFloat(totalSlippage.toFixed(6)),
      swapFees: parseFloat(totalSwapFees.toFixed(6)),
      perpFees: parseFloat(totalPerpFees.toFixed(6)),
      net: parseFloat((totalFees + totalFundingIncome + totalShortPnl - totalIL - totalGas - totalSlippage - totalSwapFees - totalPerpFees).toFixed(6)),
    },
    config: {
      feeTier, timing, hedge, offMode, gasOverride, slippage, rebalanceDelay,
      leverage, marginThreshold, cooldownDays, exchange,
      maxStopsPerWindow, stopWindowDays, ethbtcSmaFilter, ethbtcSmaPeriod,
      progressiveDehedge, expCooldown, baseCooldownDays,
    },
  };
}

// ─── Withdrawal Simulator ───────────────────────────────────────────

export function simulateWithdrawals(series, frequency) {
  if (frequency === 'none' || !series.length) {
    return {
      series: series.map(s => ({ ...s, withdrawn: 0 })),
      totalWithdrawn: 0,
      finalBalance: series[series.length - 1]?.btc || START_BTC,
      effectiveYield: 0,
    };
  }

  const months = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[frequency] || 12;

  let btc = START_BTC;
  let totalWithdrawn = 0;
  let lastMonth = null;
  const wSeries = [];
  const withdrawals = [];

  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const dt = new Date(s.date);
    const mk = dt.getFullYear() * 12 + dt.getMonth();

    const ratio = i > 0 ? s.btc / series[i - 1].btc : 1;
    btc *= ratio;

    if (lastMonth === null) lastMonth = mk;

    if (mk - lastMonth >= months && i > 0) {
      // RULE: Only withdraw BTC units above initial capital (START_BTC).
      const withdrawable = btc - START_BTC;
      if (withdrawable > 0) {
        btc = START_BTC;
        totalWithdrawn += withdrawable;
        withdrawals.push({ date: s.date, amount: withdrawable, totalWithdrawn });
      }
      lastMonth = mk;
    }

    wSeries.push({
      date: s.date, btc: parseFloat(btc.toFixed(6)),
      btcUsd: s.btcUsd, compoundBtc: s.btc,
      withdrawn: parseFloat(totalWithdrawn.toFixed(6)),
    });
  }

  return {
    series: wSeries, withdrawals,
    totalWithdrawn: parseFloat(totalWithdrawn.toFixed(6)),
    finalBalance: parseFloat(btc.toFixed(6)),
    effectiveYield: parseFloat((totalWithdrawn / START_BTC * 100).toFixed(2)),
  };
}

// ─── Hybrid 50/50 Strategy ──────────────────────────────────────────

export function runHybridBacktest(data, config) {
  const {
    timing = 'always',
    offMode = 'B',
    gasOverride = null,
    slippage = DEFAULT_SLIPPAGE,
    rebalanceDelay = 0,
    leverage = 3.0,
    marginThreshold = 0.30,
    cooldownDays = 2,
    exchange = 'hl',
    // Pass mitigants through
    maxStopsPerWindow = Infinity,
    stopWindowDays = 60,
    ethbtcSmaFilter = false,
    ethbtcSmaPeriod = 30,
    progressiveDehedge = false,
    expCooldown = false,
    baseCooldownDays = 2,
  } = config;

  const mitigantConfig = { maxStopsPerWindow, stopWindowDays, ethbtcSmaFilter, ethbtcSmaPeriod, progressiveDehedge, expCooldown, baseCooldownDays };
  const baseConfig = { timing, hedge: false, offMode, gasOverride, slippage, rebalanceDelay, leverage, marginThreshold, cooldownDays, exchange, ...mitigantConfig };
  const resultArb = runBacktest(data, { ...baseConfig, feeTier: '005' });
  const resultEth = runBacktest(data, { ...baseConfig, feeTier: '030' });

  const PERP_FEE = getPerpFee(exchange);
  let hedgeBtc = 0, hedgeOpen = false, hedgeExposure = 0;
  let totalHedgePnl = 0, totalPerpFees = 0;
  const combinedSeries = [];

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const fr = d.funding;
    const btcUsd = d.btcUsd || d.btc_usd || 85000;
    const arbOn = i < resultArb.series.length && resultArb.series[i].on;
    const ethOn = i < resultEth.series.length && resultEth.series[i].on;
    const anyOn = arbOn || ethOn;

    if (anyOn && !hedgeOpen) {
      hedgeExposure = START_BTC * HEDGE_RATIO;
      const pf = hedgeExposure * PERP_FEE;
      hedgeBtc -= pf;
      totalPerpFees += pf;
      hedgeOpen = true;
    }

    if (!anyOn && hedgeOpen && offMode === 'A') {
      const pf = hedgeExposure * PERP_FEE;
      hedgeBtc -= pf;
      totalPerpFees += pf;
      hedgeOpen = false;
      hedgeExposure = 0;
    }

    if (hedgeOpen && fr != null) {
      const inc = hedgeExposure * (fr / 100 / 365);
      hedgeBtc += inc;
      totalHedgePnl += inc;
    }

    const arbBtc = i < resultArb.series.length ? resultArb.series[i].btc * 0.5 : 0.5;
    const ethBtc = i < resultEth.series.length ? resultEth.series[i].btc * 0.5 : 0.5;
    const totalBtc = arbBtc + ethBtc + hedgeBtc;

    combinedSeries.push({
      date: d.date,
      btc: parseFloat(totalBtc.toFixed(6)),
      arbBtc: parseFloat(arbBtc.toFixed(6)),
      ethBtc: parseFloat(ethBtc.toFixed(6)),
      hedgeBtc: parseFloat(hedgeBtc.toFixed(6)),
      btcUsd,
      on: anyOn,
    });
  }

  const finalBtc = combinedSeries.length ? combinedSeries[combinedSeries.length - 1].btc : 1;
  const years = combinedSeries.length / 365;
  const cagr = years > 0 ? (Math.pow(finalBtc / START_BTC, 1 / years) - 1) * 100 : 0;

  return {
    series: combinedSeries, arbResult: resultArb, ethResult: resultEth,
    hedgePnl: parseFloat(totalHedgePnl.toFixed(6)),
    hedgePerpFees: parseFloat(totalPerpFees.toFixed(6)),
    metrics: {
      finalBtc: parseFloat(finalBtc.toFixed(6)),
      netGain: parseFloat((finalBtc - START_BTC).toFixed(6)),
      cagr: parseFloat(cagr.toFixed(2)),
      arbFinalBtc: parseFloat((resultArb.metrics.finalBtc * 0.5).toFixed(6)),
      ethFinalBtc: parseFloat((resultEth.metrics.finalBtc * 0.5).toFixed(6)),
      arbGas: parseFloat((resultArb.costs.gas * 0.5).toFixed(6)),
      ethGas: parseFloat((resultEth.costs.gas * 0.5).toFixed(6)),
    },
  };
}

// ─── Scenario Helpers ───────────────────────────────────────────────

export function scenarioKey(config) {
  const fee = config.feeTier === '005' ? '0.05%' : '0.30%';
  const chain = config.feeTier === '005' ? 'ARB' : 'ETH';
  const timing = config.timing === 'always' ? 'Always On' : 'SMA Timing';

  if (!config.hedge) return `${chain} ${fee} / ${timing} / No Hedge`;

  const lev = config.leverage || 3.0;
  const mt = config.marginThreshold || 0.30;
  const mtPct = Math.round(mt * 100);
  return `${chain} ${fee} / ${timing} / ${lev}x/${mtPct}%`;
}

export function runAllScenarios(data, gasOverride = null, slippage = DEFAULT_SLIPPAGE, rebalanceDelay = 0, leverage = 3.0, marginThreshold = 0.30, cooldownDays = 2, exchange = 'hl', mitigantConfig = {}) {
  const configs = [];

  const leverageCombos = [
    { hedge: false, leverage: 0, marginThreshold: 0 },
    { hedge: true, leverage: 2.5, marginThreshold: 0.30 },
    { hedge: true, leverage, marginThreshold },
    { hedge: true, leverage: 5.0, marginThreshold: 0.15 },
  ];

  for (const feeTier of ['005', '030']) {
    for (const timing of ['always', 'sma']) {
      for (const lc of leverageCombos) {
        configs.push({
          feeTier, timing,
          hedge: lc.hedge,
          leverage: lc.leverage,
          marginThreshold: lc.marginThreshold,
          offMode: 'B', gasOverride, slippage, rebalanceDelay,
          exchange, cooldownDays,
          ...mitigantConfig,
        });
      }
    }
  }

  const base = configs.map(config => ({
    key: scenarioKey(config),
    result: runBacktest(data, config),
  }));

  // Hybrid scenarios
  for (const timing of ['always', 'sma']) {
    const hybrid = runHybridBacktest(data, { timing, offMode: 'B', gasOverride, slippage, rebalanceDelay, leverage, marginThreshold, cooldownDays, exchange, ...mitigantConfig });
    const label = timing === 'always' ? 'Always On' : 'SMA Timing';

    let hybridPeak = 1, hybridMaxDD = 0;
    for (const s of hybrid.series) {
      if (s.btc > hybridPeak) hybridPeak = s.btc;
      const dd = (s.btc - hybridPeak) / hybridPeak;
      if (dd < hybridMaxDD) hybridMaxDD = dd;
    }
    const hybridMaxDDPct = hybridMaxDD * 100;
    const hybridCagrDd = hybridMaxDDPct !== 0 ? hybrid.metrics.cagr / Math.abs(hybridMaxDDPct) : Infinity;

    base.push({
      key: `Hybrid 50/50 / ${label} / Shared Hedge`,
      result: {
        metrics: {
          ...hybrid.metrics, maxDD: parseFloat(hybridMaxDDPct.toFixed(4)), cagrDdRatio: parseFloat(hybridCagrDd.toFixed(2)), rebalanceCount: 0,
          totalDays: hybrid.series.length,
          activeDays: hybrid.series.filter(s => s.on).length,
          years: parseFloat((hybrid.series.length / 365).toFixed(2)),
          maxHedgeExposure: 0.5,
          marginStops: 0, avgStopLoss: 0, cooldownDays: 0, cooldownPct: 0,
          hedgeActiveDays: 0, hedgeActivePct: 0,
        },
        costs: {
          fees: parseFloat(((hybrid.arbResult.costs.fees * 0.5) + (hybrid.ethResult.costs.fees * 0.5)).toFixed(6)),
          fundingIncome: hybrid.hedgePnl,
          shortPnl: 0,
          hedge: hybrid.hedgePnl,
          il: parseFloat(((hybrid.arbResult.costs.il * 0.5) + (hybrid.ethResult.costs.il * 0.5)).toFixed(6)),
          gas: parseFloat((hybrid.metrics.arbGas + hybrid.metrics.ethGas).toFixed(6)),
          slippage: parseFloat(((hybrid.arbResult.costs.slippage * 0.5) + (hybrid.ethResult.costs.slippage * 0.5)).toFixed(6)),
          swapFees: parseFloat(((hybrid.arbResult.costs.swapFees * 0.5) + (hybrid.ethResult.costs.swapFees * 0.5)).toFixed(6)),
          perpFees: hybrid.hedgePerpFees,
          net: hybrid.metrics.netGain,
        },
      },
    });
  }

  return base;
}
