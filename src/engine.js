/**
 * DeltaYield V4 — Backtest Engine (Margin Stop-Loss + ETHUSDT Short Model)
 *
 * All formulas from the brief — zero synthetic data.
 * V4 changes:
 *   - ETHUSDT short model (P&L in USD, converted to BTC)
 *   - Margin stop-loss with configurable threshold and cooldown
 *   - Leverage-based collateral sizing
 *   - Per-exchange perp fees (Hyperliquid 0.045%, Binance 0.050%)
 *   - Priority order: margin stop > cooldown > range check > fees
 *   - Backward-compatible data field names (camelCase + snake_case)
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

// ─── Main Backtest (V4) ─────────────────────────────────────────────

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
  } = config;

  const PERP_FEE = getPerpFee(exchange);
  const swapFee = feeTier === '005' ? SWAP_FEE_005 : SWAP_FEE_030;
  const apyKey = feeTier === '005' ? 'apy_005' : 'apy_030';
  const gasKey = feeTier === '005' ? 'gas_arb' : 'gas_eth';
  const cooldownLength = cooldownDays;

  // ─── CRITICAL: Truncate data at last day with complete ethbtc data ───
  // Without ethbtc, the short P&L calculation uses eu=0 (null*number=0 in JS)
  // which creates a fictitious massive short profit. We MUST NOT run the
  // backtest past the last day with real ethbtc data.
  let lastEthbtcIdx = data.length - 1;
  while (lastEthbtcIdx > 0 && data[lastEthbtcIdx].ethbtc == null) {
    lastEthbtcIdx--;
  }
  const truncatedData = data.slice(0, lastEthbtcIdx + 1);

  // ─── State ──────────────────────────────────────────────
  let lpBtc = START_BTC;    // BTC in LP
  let scBtc = 0;            // short collateral in BTC
  let scUsd = 0;            // short collateral in USD
  let scInitUsd = 0;        // initial collateral USD at position open (for margin calc)
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

  // Cumulative costs
  let totalFees = 0, totalHedge = 0, totalIL = 0, totalGas = 0;
  let totalSlippage = 0, totalSwapFees = 0, totalPerpFees = 0;
  let cumulShortPnlBtc = 0;

  const positions = [];
  let currentPosition = null;
  const series = [];

  // ─── Helper: get gas in USD for a day ───────────────────
  function getGasUsd(d) {
    if (gasOverride != null) return gasOverride;
    // Support both camelCase and snake_case field names
    const gasArb = d.gasArb || d.gas_arb || 0.03;
    const gasEth = d.gasEth || d.gas_eth || 0.50;
    return feeTier === '005' ? gasArb : gasEth;
  }

  // ─── Helper: read btcUsd from data ─────────────────────
  function getBtcUsd(d) {
    return d.btcUsd || d.btc_usd || 85000;
  }

  // ─── Helper: open position ─────────────────────────────
  function doOpen(d) {
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

    if (hedge) {
      // Split: LP gets (1 - hedgeRatio/leverage), short collateral gets hedgeRatio/leverage
      let scBtcNew = totalAum * HEDGE_RATIO / leverage;
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

      // Short: notional = totalAum * HEDGE_RATIO * bu
      const shortNotionalUsd = totalAum * HEDGE_RATIO * bu;
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

      // Swap fee + slippage on LP half (swapping 50% of LP from BTC to WETH)
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
      // No hedge: all goes to LP
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

    // SAFETY: If ethbtc is null/0, we cannot compute short P&L or IL.
    // This should not happen with truncated data, but guard against it.
    if (!eb || eb <= 0) {
      // Just consolidate LP + existing scBtc (no short close, no IL)
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
      const il = lpBtc * calcIL(r);  // calcIL returns negative
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
    if (hedge && shortOpen) {
      const pnlUsd = (shortEntryEthUsd - eu) * shortQtyEth;
      scUsd += pnlUsd;

      // Track short P&L in BTC
      const shortPnlBtc = pnlUsd / bu;
      cumulShortPnlBtc += shortPnlBtc;
      if (currentPosition) currentPosition.hedgePnl += shortPnlBtc;

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
    if (pnl >= 0) return false; // profitable, no stop
    return Math.abs(pnl) / scInitUsd >= marginThreshold;
  }

  // ─── Main Loop (uses truncatedData — stops at last valid ethbtc) ───
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

      currentPosition = {
        entryDate: date, exitDate: null,
        entryPrice: ethbtc, exitPrice: null,
        entryBtc: lpBtc + scBtc, exitBtc: null,
        fees: 0, hedgePnl: 0, il: 0, gas: 0,
        slippage: 0, swapFees: 0, perpFees: 0,
        rebalances: 0, closeReason: null,
        entryWbtcPct: 0.5, entryWethPct: 0.5,
        exitWbtcPct: null, exitWethPct: null,
      };

      doOpen(d);
    }

    // ─── ON → OFF transition ─────────────────────────────
    if (!on && wasOn && currentPosition) {
      doClose(d);

      currentPosition.exitDate = date;
      currentPosition.exitPrice = ethbtc || currentPosition.entryPrice;
      currentPosition.exitBtc = lpBtc + scBtc;
      currentPosition.closeReason = 'sma_off';

      if (ethbtc && currentPosition.entryPrice) {
        const r = ethbtc / currentPosition.entryPrice;
        currentPosition.exitWbtcPct = Math.min(1, Math.max(0, 0.5 + (r - 1) * 2.5));
        currentPosition.exitWethPct = 1 - currentPosition.exitWbtcPct;
      }

      positions.push(currentPosition);
      currentPosition = null;
      pendingRebalance = false;
      rangeExitDay = null;
      inCooldown = false;
      cooldownRemaining = 0;
    }

    // ─── Daily ON logic ──────────────────────────────────
    if (on && ethbtc != null && apy != null) {

      // ═══ PRIORITY 1: Margin stop check ═══
      if (hedge && checkMarginStop(d)) {
        marginStopToday = true;
        marginStopCount++;

        // Record loss before closing
        const totalBefore = lpBtc + scBtc;

        // Force close everything
        doClose(d);

        const totalAfter = lpBtc + scBtc;
        const stopLoss = totalBefore - totalAfter;
        if (stopLoss > 0) totalStopLoss += stopLoss;

        // Close current position, enter cooldown
        inCooldown = true;
        cooldownRemaining = cooldownLength;
        pendingRebalance = false;
        rangeExitDay = null;
        rebalanceCount++;

        if (currentPosition) {
          currentPosition.exitDate = date;
          currentPosition.exitPrice = ethbtc || currentPosition.entryPrice;
          currentPosition.exitBtc = lpBtc + scBtc;
          currentPosition.closeReason = 'margin_stop';
          if (ethbtc && currentPosition.entryPrice) {
            const r = ethbtc / currentPosition.entryPrice;
            currentPosition.exitWbtcPct = Math.min(1, Math.max(0, 0.5 + (r - 1) * 2.5));
            currentPosition.exitWethPct = 1 - currentPosition.exitWbtcPct;
          }
          positions.push(currentPosition);
          currentPosition = null;
        }

        // If cooldown is 0, immediately reopen
        if (cooldownLength === 0) {
          inCooldown = false;
          currentPosition = {
            entryDate: date, exitDate: null,
            entryPrice: ethbtc, exitPrice: null,
            entryBtc: lpBtc + scBtc, exitBtc: null,
            fees: 0, hedgePnl: 0, il: 0, gas: 0,
            slippage: 0, swapFees: 0, perpFees: 0,
            rebalances: 0, closeReason: null,
            entryWbtcPct: 0.5, entryWethPct: 0.5,
            exitWbtcPct: null, exitWethPct: null,
          };
          doOpen(d);
        }
      }

      // ═══ PRIORITY 2: Cooldown ═══
      else if (inCooldown) {
        // No fees, no hedge — just wait
        cooldownRemaining--;
        totalCooldownDaysSpent++;

        if (cooldownRemaining <= 0) {
          // Cooldown over: reopen at current prices
          inCooldown = false;
          currentPosition = {
            entryDate: date, exitDate: null,
            entryPrice: ethbtc, exitPrice: null,
            entryBtc: lpBtc + scBtc, exitBtc: null,
            fees: 0, hedgePnl: 0, il: 0, gas: 0,
            slippage: 0, swapFees: 0, perpFees: 0,
            rebalances: 0, closeReason: null,
            entryWbtcPct: 0.5, entryWethPct: 0.5,
            exitWbtcPct: null, exitWethPct: null,
          };
          doOpen(d);
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
        if (hedge && shortOpen && fundingRate != null) {
          const fundingBtc = scBtc * (fundingRate / 100 / 365);
          // Actually funding accrues on the notional, via scUsd
          // But for simplicity and consistency, apply via funding rate on hedge exposure
          const hedgeExposureBtc = (lpBtc + scBtc) * HEDGE_RATIO;
          const hi = hedgeExposureBtc * (fundingRate / 100 / 365);
          // Funding goes to collateral in USD
          scUsd += hi * btcUsd;
          totalHedge += hi;
          if (currentPosition) currentPosition.hedgePnl += hi;
        }

        // Check if delay period has elapsed
        if (i - rangeExitDay >= rebalanceDelay) {
          // Close current position
          doClose(d);
          rebalanceCount++;

          if (currentPosition) {
            currentPosition.exitDate = date;
            currentPosition.exitPrice = ethbtc || currentPosition.entryPrice;
            currentPosition.exitBtc = lpBtc + scBtc;
            currentPosition.closeReason = 'rebalance';
            if (ethbtc && currentPosition.entryPrice) {
              const r = ethbtc / currentPosition.entryPrice;
              currentPosition.exitWbtcPct = Math.min(1, Math.max(0, 0.5 + (r - 1) * 2.5));
              currentPosition.exitWethPct = 1 - currentPosition.exitWbtcPct;
            }
            positions.push(currentPosition);
          }

          // Open new position
          currentPosition = {
            entryDate: date, exitDate: null,
            entryPrice: ethbtc, exitPrice: null,
            entryBtc: lpBtc + scBtc, exitBtc: null,
            fees: 0, hedgePnl: 0, il: 0, gas: 0,
            slippage: 0, swapFees: 0, perpFees: 0,
            rebalances: 0, closeReason: null,
            entryWbtcPct: 0.5, entryWethPct: 0.5,
            exitWbtcPct: null, exitWethPct: null,
          };
          doOpen(d);

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
        if (hedge && shortOpen && fundingRate != null) {
          const hedgeExposureBtc = (lpBtc + scBtc) * HEDGE_RATIO;
          const hi = hedgeExposureBtc * (fundingRate / 100 / 365);
          scUsd += hi * btcUsd;
          totalHedge += hi;
          if (currentPosition) currentPosition.hedgePnl += hi;
        }

        // Check range exit
        if (rangeCenter != null) {
          const drift = Math.abs(ethbtc / rangeCenter - 1);
          if (drift >= REBALANCE_THRESHOLD) {
            if (rebalanceDelay > 0) {
              pendingRebalance = true;
              rangeExitDay = i;
            } else {
              // Instant rebalance: close current position
              doClose(d);
              rebalanceCount++;

              if (currentPosition) {
                currentPosition.exitDate = date;
                currentPosition.exitPrice = ethbtc || currentPosition.entryPrice;
                currentPosition.exitBtc = lpBtc + scBtc;
                currentPosition.closeReason = 'rebalance';
                if (ethbtc && currentPosition.entryPrice) {
                  const r = ethbtc / currentPosition.entryPrice;
                  currentPosition.exitWbtcPct = Math.min(1, Math.max(0, 0.5 + (r - 1) * 2.5));
                  currentPosition.exitWethPct = 1 - currentPosition.exitWbtcPct;
                }
                positions.push(currentPosition);
              }

              // Open new position
              currentPosition = {
                entryDate: date, exitDate: null,
                entryPrice: ethbtc, exitPrice: null,
                entryBtc: lpBtc + scBtc, exitBtc: null,
                fees: 0, hedgePnl: 0, il: 0, gas: 0,
                slippage: 0, swapFees: 0, perpFees: 0,
                rebalances: 0, closeReason: null,
                entryWbtcPct: 0.5, entryWethPct: 0.5,
                exitWbtcPct: null, exitWethPct: null,
              };
              doOpen(d);
            }
          }
        }
      }
    }

    // ─── OFF but hedge open (Mode B legacy compat) ───────
    if (!on && hedge && shortOpen && offMode === 'B' && fundingRate != null) {
      const hedgeExposureBtc = (lpBtc + scBtc) * HEDGE_RATIO;
      const hi = hedgeExposureBtc * (fundingRate / 100 / 365);
      scUsd += hi * btcUsd;
      totalHedge += hi;
    }

    // ─── Track peak & drawdown ───────────────────────────
    const totalAum = lpBtc + scBtc;
    if (totalAum > peak) peak = totalAum;
    const dd = (totalAum - peak) / peak;
    if (dd < maxDD) maxDD = dd;

    wasOn = on;

    // ─── Series entry ────────────────────────────────────
    // Compute current scBtc including unrealized short P&L for display
    let displayScBtc = scBtc;
    if (hedge && shortOpen && ethbtc) {
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
      hedge: parseFloat(totalHedge.toFixed(6)),
      il: parseFloat(totalIL.toFixed(6)),
      inCooldown,
      pendingRebalance,
      marginStop: marginStopToday,
      ethUsd: ethbtc ? parseFloat((ethbtc * btcUsd).toFixed(2)) : null,
      shortPnlBtc: parseFloat(cumulShortPnlBtc.toFixed(6)),
      // Legacy fields for backward compatibility
      ethbtc: ethbtc || null,
      btceth: ethbtc ? parseFloat((1 / ethbtc).toFixed(4)) : null,
      apy: apy ?? null,
      funding: fundingRate ?? null,
      on,
      hedgeOpen: shortOpen,
      hedgeExposure: hedge ? parseFloat(((lpBtc + scBtc) * HEDGE_RATIO).toFixed(6)) : 0,
      rangeCenter: rangeCenter ? parseFloat(rangeCenter.toFixed(8)) : null,
      rangeLower: rangeCenter ? parseFloat((rangeCenter * (1 - RANGE_WIDTH)).toFixed(8)) : null,
      rangeUpper: rangeCenter ? parseFloat((rangeCenter * (1 + RANGE_WIDTH)).toFixed(8)) : null,
    });
  }

  // ─── Close final open position (use last valid day, NOT null tail) ───
  if (currentPosition) {
    const lastValid = truncatedData[truncatedData.length - 1];
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
      // V4 new fields
      marginStops: marginStopCount,
      avgStopLoss: marginStopCount > 0 ? parseFloat((totalStopLoss / marginStopCount).toFixed(6)) : 0,
      cooldownDays: totalCooldownDaysSpent,
      cooldownPct: totalDays > 0 ? parseFloat((totalCooldownDaysSpent / totalDays * 100).toFixed(2)) : 0,
    },
    costs: {
      fees: parseFloat(totalFees.toFixed(6)),
      hedge: parseFloat(totalHedge.toFixed(6)),
      il: parseFloat(totalIL.toFixed(6)),
      gas: parseFloat(totalGas.toFixed(6)),
      slippage: parseFloat(totalSlippage.toFixed(6)),
      swapFees: parseFloat(totalSwapFees.toFixed(6)),
      perpFees: parseFloat(totalPerpFees.toFixed(6)),
      net: parseFloat((totalFees + totalHedge - totalIL - totalGas - totalSlippage - totalSwapFees - totalPerpFees).toFixed(6)),
    },
    config: {
      feeTier, timing, hedge, offMode, gasOverride, slippage, rebalanceDelay,
      leverage, marginThreshold, cooldownDays, exchange,
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
  let periodStartBtc = START_BTC;
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
      const profit = btc - periodStartBtc;
      if (profit > 0) {
        btc -= profit;
        totalWithdrawn += profit;
        withdrawals.push({ date: s.date, amount: profit, totalWithdrawn });
      }
      periodStartBtc = btc;
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
  } = config;

  const baseConfig = { timing, hedge: false, offMode, gasOverride, slippage, rebalanceDelay, leverage, marginThreshold, cooldownDays, exchange };
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

export function runAllScenarios(data, gasOverride = null, slippage = DEFAULT_SLIPPAGE, rebalanceDelay = 0, leverage = 3.0, marginThreshold = 0.30, cooldownDays = 2, exchange = 'hl') {
  const configs = [];

  // Grid: feeTier x timing x hedge combos
  const leverageCombos = [
    { hedge: false, leverage: 0, marginThreshold: 0 },          // unhedged
    { hedge: true, leverage: 2.5, marginThreshold: 0.30 },      // 2.5x / 30%
    { hedge: true, leverage, marginThreshold },                  // user's current config
    { hedge: true, leverage: 5.0, marginThreshold: 0.15 },      // 5x / 15%
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
          exchange,
          cooldownDays,
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
    const hybrid = runHybridBacktest(data, { timing, offMode: 'B', gasOverride, slippage, rebalanceDelay, leverage, marginThreshold, cooldownDays, exchange });
    const label = timing === 'always' ? 'Always On' : 'SMA Timing';

    // Calculate actual MaxDD from the combined hybrid series
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
        },
        costs: {
          fees: parseFloat(((hybrid.arbResult.costs.fees * 0.5) + (hybrid.ethResult.costs.fees * 0.5)).toFixed(6)),
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
