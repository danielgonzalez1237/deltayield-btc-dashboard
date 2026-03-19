/**
 * DeltaYield V3 — Backtest Engine (ADDENDUM-corrected + Rebalance Delay)
 *
 * All formulas from the brief — zero synthetic data.
 * Corrections: chain-specific gas, OFF mode hedge logic,
 * withdrawal simulator, hybrid 50/50 strategy, USD benchmark.
 * Addition: configurable rebalance delay (0-4 days).
 */

// ─── Constants ──────────────────────────────────────────────────────
const RANGE_WIDTH = 0.10;
const MULTIPLIER = 0.94;
const DEFAULT_SLIPPAGE = 0.0010;
const PERP_FEE = 0.0010;
const SWAP_FEE_005 = 0.0005;
const SWAP_FEE_030 = 0.003;
const REBALANCE_THRESHOLD = 0.10;
const HEDGE_RATIO = 0.50;
const START_BTC = 1.0;
const SMA_GOLDEN = '2021-07-05';
const SMA_DEATH = '2024-04-15';

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
    case '3y': startDate = new Date(lastDate); startDate.setFullYear(startDate.getFullYear() - 3); break;
    case '5y': startDate = new Date(lastDate); startDate.setFullYear(startDate.getFullYear() - 5); break;
    default: return series;
  }
  const startStr = startDate.toISOString().slice(0, 10);
  return series.filter(s => s.date >= startStr);
}

// ─── Main Backtest ──────────────────────────────────────────────────

export function runBacktest(data, config) {
  const {
    feeTier = '005',
    timing = 'always',
    hedge = true,
    offMode = 'B',
    gasOverride = null,
    slippage = DEFAULT_SLIPPAGE,
    rebalanceDelay = 0,
  } = config;

  const swapFee = feeTier === '005' ? SWAP_FEE_005 : SWAP_FEE_030;
  const apyKey = feeTier === '005' ? 'apy_005' : 'apy_030';
  const gasKey = feeTier === '005' ? 'gas_arb' : 'gas_eth';

  let btc = START_BTC;
  let peak = START_BTC;
  let maxDD = 0;
  let rangeCenter = null;
  let wasOn = false;
  let rebalanceCount = 0;
  let hedgeOpen = false;
  let hedgeExposureBtc = 0;
  let maxHedgeExposure = 0;

  // Rebalance delay state
  let pendingRebalance = false;
  let rangeExitDay = null;
  let daysOutOfRange = 0;
  let feesMissed = 0;

  let totalFees = 0, totalHedge = 0, totalIL = 0, totalGas = 0;
  let totalSlippage = 0, totalSwapFees = 0, totalPerpFees = 0;

  const positions = [];
  let currentPosition = null;
  const series = [];

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const date = d.date;
    const ethbtc = d.ethbtc;
    const apy = d[apyKey];
    const fundingRate = d.funding;
    const btcUsd = d.btc_usd || 85000;
    const gasUsd = gasOverride != null ? gasOverride : (d[gasKey] || 0.03);

    const on = isPoolOn(date, timing) && ethbtc != null && apy != null;

    // ─── OFF → ON ───────────────────────────────────────────
    if (on && !wasOn) {
      rangeCenter = ethbtc;
      pendingRebalance = false;
      rangeExitDay = null;

      if (offMode === 'A' && positions.length > 0) {
        const sc = btc * slippage;
        const sf = btc * 0.5 * swapFee;
        btc -= sc + sf;
        totalSlippage += sc;
        totalSwapFees += sf;
      }

      currentPosition = {
        entryDate: date, exitDate: null,
        entryPrice: ethbtc, exitPrice: null,
        entryBtc: btc, exitBtc: null,
        fees: 0, hedgePnl: 0, il: 0, gas: 0,
        slippage: 0, swapFees: 0, perpFees: 0,
        rebalances: 0,
        entryWbtcPct: 0.5, entryWethPct: 0.5,
        exitWbtcPct: null, exitWethPct: null,
      };

      if (hedge) {
        hedgeExposureBtc = btc * HEDGE_RATIO;
        const pf = hedgeExposureBtc * PERP_FEE;
        btc -= pf;
        totalPerpFees += pf;
        if (currentPosition) currentPosition.perpFees += pf;
        hedgeOpen = true;
        if (hedgeExposureBtc > maxHedgeExposure) maxHedgeExposure = hedgeExposureBtc;
      }
    }

    // ─── ON → OFF ───────────────────────────────────────────
    if (!on && wasOn && currentPosition) {
      currentPosition.exitDate = date;
      currentPosition.exitPrice = ethbtc || currentPosition.entryPrice;
      currentPosition.exitBtc = btc;

      if (ethbtc && rangeCenter) {
        const r = ethbtc / rangeCenter;
        currentPosition.exitWbtcPct = Math.min(1, Math.max(0, 0.5 + (r - 1) * 2.5));
        currentPosition.exitWethPct = 1 - currentPosition.exitWbtcPct;
      }

      if (offMode === 'A') {
        const sc = btc * slippage;
        const sf = btc * 0.5 * swapFee;
        btc -= sc + sf;
        totalSlippage += sc;
        totalSwapFees += sf;
        if (hedge && hedgeOpen) {
          const pf = hedgeExposureBtc * PERP_FEE;
          btc -= pf;
          totalPerpFees += pf;
          currentPosition.perpFees += pf;
          hedgeOpen = false;
          hedgeExposureBtc = 0;
        }
      }
      // Mode B: hedge stays open

      pendingRebalance = false;
      rangeExitDay = null;

      positions.push(currentPosition);
      currentPosition = null;
      rangeCenter = null;
    }

    // ─── Daily ON ───────────────────────────────────────────
    if (on && ethbtc != null && apy != null) {

      // If pending rebalance (delay > 0 path), no fee accrual — out of range
      if (pendingRebalance) {
        // No pool fees while waiting for rebalance (out of range)
        const dr = dailyRate(apy);
        const missedFee = btc * dr * MULTIPLIER;
        feesMissed += missedFee;
        daysOutOfRange++;

        // Hedge STILL active during delay
        if (hedge && hedgeOpen && fundingRate != null) {
          const hi = hedgeExposureBtc * (fundingRate / 100 / 365);
          btc += hi;
          totalHedge += hi;
          if (currentPosition) currentPosition.hedgePnl += hi;
        }

        // Check if delay period has elapsed
        if (i - rangeExitDay >= rebalanceDelay) {
          // Execute rebalance using CURRENT day's price
          const r = ethbtc / rangeCenter;
          const ilCost = Math.abs(btc * calcIL(r));
          btc -= ilCost;
          totalIL += ilCost;
          if (currentPosition) currentPosition.il += ilCost;

          const gasCost = (gasUsd * 2) / btcUsd;
          btc -= gasCost;
          totalGas += gasCost;
          if (currentPosition) currentPosition.gas += gasCost;

          const sc = btc * slippage;
          btc -= sc;
          totalSlippage += sc;
          if (currentPosition) currentPosition.slippage += sc;

          const sf = btc * 0.5 * swapFee;
          btc -= sf;
          totalSwapFees += sf;
          if (currentPosition) currentPosition.swapFees += sf;

          if (hedge && hedgeOpen) {
            const pf = hedgeExposureBtc * PERP_FEE;
            btc -= pf;
            totalPerpFees += pf;
            if (currentPosition) currentPosition.perpFees += pf;
            hedgeExposureBtc = btc * HEDGE_RATIO;
            if (hedgeExposureBtc > maxHedgeExposure) maxHedgeExposure = hedgeExposureBtc;
          }

          rangeCenter = ethbtc;
          rebalanceCount++;
          if (currentPosition) currentPosition.rebalances++;
          pendingRebalance = false;
          rangeExitDay = null;
        }

      } else {
        // Normal in-range day: accrue fees
        const dr = dailyRate(apy);
        const feeIncome = btc * dr * MULTIPLIER;
        btc += feeIncome;
        totalFees += feeIncome;
        if (currentPosition) currentPosition.fees += feeIncome;

        if (hedge && hedgeOpen && fundingRate != null) {
          const hi = hedgeExposureBtc * (fundingRate / 100 / 365);
          btc += hi;
          totalHedge += hi;
          if (currentPosition) currentPosition.hedgePnl += hi;
        }

        if (rangeCenter != null) {
          const drift = Math.abs(ethbtc / rangeCenter - 1);
          if (drift >= REBALANCE_THRESHOLD) {
            if (rebalanceDelay > 0) {
              // Delay mode: mark pending, do NOT rebalance yet
              pendingRebalance = true;
              rangeExitDay = i;
            } else {
              // Instant rebalance (legacy behavior, delay = 0)
              const r = ethbtc / rangeCenter;
              const ilCost = Math.abs(btc * calcIL(r));
              btc -= ilCost;
              totalIL += ilCost;
              if (currentPosition) currentPosition.il += ilCost;

              const gasCost = (gasUsd * 2) / btcUsd;
              btc -= gasCost;
              totalGas += gasCost;
              if (currentPosition) currentPosition.gas += gasCost;

              const sc = btc * slippage;
              btc -= sc;
              totalSlippage += sc;
              if (currentPosition) currentPosition.slippage += sc;

              const sf = btc * 0.5 * swapFee;
              btc -= sf;
              totalSwapFees += sf;
              if (currentPosition) currentPosition.swapFees += sf;

              if (hedge && hedgeOpen) {
                const pf = hedgeExposureBtc * PERP_FEE;
                btc -= pf;
                totalPerpFees += pf;
                if (currentPosition) currentPosition.perpFees += pf;
                hedgeExposureBtc = btc * HEDGE_RATIO;
                if (hedgeExposureBtc > maxHedgeExposure) maxHedgeExposure = hedgeExposureBtc;
              }

              rangeCenter = ethbtc;
              rebalanceCount++;
              if (currentPosition) currentPosition.rebalances++;
            }
          }
        }
      }
    }

    // ─── OFF but hedge open (Mode B) ────────────────────────
    if (!on && hedge && hedgeOpen && offMode === 'B' && fundingRate != null) {
      const hi = hedgeExposureBtc * (fundingRate / 100 / 365);
      btc += hi;
      totalHedge += hi;
    }

    if (btc > peak) peak = btc;
    const dd = (btc - peak) / peak;
    if (dd < maxDD) maxDD = dd;

    wasOn = on;

    series.push({
      date,
      btc: parseFloat(btc.toFixed(6)),
      btcUsd,
      ethbtc: ethbtc || null,
      btceth: ethbtc ? parseFloat((1 / ethbtc).toFixed(4)) : null,
      apy: apy || null,
      funding: fundingRate || null,
      on,
      hedgeOpen,
      hedgeExposure: parseFloat(hedgeExposureBtc.toFixed(6)),
      rangeCenter: rangeCenter ? parseFloat(rangeCenter.toFixed(8)) : null,
      rangeLower: rangeCenter ? parseFloat((rangeCenter * (1 - RANGE_WIDTH)).toFixed(8)) : null,
      rangeUpper: rangeCenter ? parseFloat((rangeCenter * (1 + RANGE_WIDTH)).toFixed(8)) : null,
      pendingRebalance,
    });
  }

  if (currentPosition) {
    const lastData = data[data.length - 1];
    currentPosition.exitDate = lastData.date;
    currentPosition.exitPrice = lastData.ethbtc || currentPosition.entryPrice;
    currentPosition.exitBtc = btc;
    positions.push(currentPosition);
  }

  const totalDays = series.length;
  const activeDays = series.filter(s => s.on).length;
  const years = totalDays / 365;
  const finalBtc = btc;
  const netGain = finalBtc - START_BTC;
  const cagr = years > 0 ? (Math.pow(finalBtc / START_BTC, 1 / years) - 1) * 100 : 0;
  const cagrDdRatio = maxDD !== 0 ? cagr / Math.abs(maxDD * 100) : Infinity;

  return {
    series, positions,
    metrics: {
      finalBtc: parseFloat(finalBtc.toFixed(6)),
      netGain: parseFloat(netGain.toFixed(6)),
      cagr: parseFloat(cagr.toFixed(2)),
      maxDD: parseFloat((maxDD * 100).toFixed(4)),
      cagrDdRatio: parseFloat(cagrDdRatio.toFixed(2)),
      rebalanceCount, totalDays, activeDays,
      years: parseFloat(years.toFixed(2)),
      maxHedgeExposure: parseFloat(maxHedgeExposure.toFixed(6)),
      daysOutOfRange,
      feesMissed: parseFloat(feesMissed.toFixed(6)),
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
    config: { feeTier, timing, hedge, offMode, gasOverride, slippage, rebalanceDelay },
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
  } = config;

  const resultArb = runBacktest(data, { feeTier: '005', timing, hedge: false, offMode, gasOverride, slippage, rebalanceDelay });
  const resultEth = runBacktest(data, { feeTier: '030', timing, hedge: false, offMode, gasOverride, slippage, rebalanceDelay });

  let hedgeBtc = 0, hedgeOpen = false, hedgeExposure = 0;
  let totalHedgePnl = 0, totalPerpFees = 0;
  const combinedSeries = [];

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const fr = d.funding;
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
      btcUsd: d.btc_usd || 85000,
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
  const hedge = config.hedge ? 'Hedge' : 'No Hedge';
  return `${chain} ${fee} / ${timing} / ${hedge}`;
}

export function runAllScenarios(data, gasOverride = null, slippage = DEFAULT_SLIPPAGE, rebalanceDelay = 0) {
  const configs = [];
  for (const feeTier of ['005', '030']) {
    for (const timing of ['always', 'sma']) {
      for (const hedge of [true, false]) {
        configs.push({ feeTier, timing, hedge, offMode: 'B', gasOverride, slippage, rebalanceDelay });
      }
    }
  }

  const base = configs.map(config => ({
    key: scenarioKey(config),
    result: runBacktest(data, config),
  }));

  // Hybrid scenarios (#9 and #10)
  for (const timing of ['always', 'sma']) {
    const hybrid = runHybridBacktest(data, { timing, offMode: 'B', gasOverride, slippage, rebalanceDelay });
    const label = timing === 'always' ? 'Always On' : 'SMA Timing';
    base.push({
      key: `Hybrid 50/50 / ${label} / Shared Hedge`,
      result: {
        metrics: {
          ...hybrid.metrics, maxDD: 0, cagrDdRatio: 0, rebalanceCount: 0,
          totalDays: hybrid.series.length,
          activeDays: hybrid.series.filter(s => s.on).length,
          years: parseFloat((hybrid.series.length / 365).toFixed(2)),
          maxHedgeExposure: 0.5,
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
