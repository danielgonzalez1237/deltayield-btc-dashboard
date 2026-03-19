/**
 * DeltaYield V3 — Backtest Engine
 *
 * Runs the concentrated liquidity backtest with real data.
 * All formulas from the brief — zero synthetic data.
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

/**
 * IL formula: 2*sqrt(r)/(1+r) - 1
 * where r = ethbtc_now / ethbtc_entry
 * Returns a negative number (loss)
 */
function calcIL(r) {
  if (r <= 0) return 0;
  return (2 * Math.sqrt(r)) / (1 + r) - 1;
}

/**
 * Daily rate from APY (compound, not linear)
 * daily_rate = (1 + APY/100)^(1/365) - 1
 */
function dailyRate(apy) {
  if (!apy || apy <= 0) return 0;
  return Math.pow(1 + apy / 100, 1 / 365) - 1;
}

/**
 * Check if pool is ON for a given date
 */
function isPoolOn(date, timingMode) {
  if (timingMode === 'always') return true;
  // SMA timing: ON only between golden cross and death cross
  return date >= SMA_GOLDEN && date < SMA_DEATH;
}

/**
 * Get gas cost in USD for a date
 */
function getGasCostUSD(date, gasOverride) {
  if (gasOverride !== undefined && gasOverride !== null) return gasOverride;
  const year = parseInt(date.slice(0, 4));
  const month = parseInt(date.slice(5, 7));
  if (year === 2021) return 3.00;
  if (year === 2022) return 1.50;
  if (year === 2023) return 0.84;
  if (year === 2024 && month < 3) return 1.50;
  if (year === 2024) return 0.03;
  return 0.03;
}

/**
 * Run the full backtest
 *
 * @param {Array} data - Unified data array [{date, ethbtc, apy_005, apy_030, funding, btc_price, gas_usd}]
 * @param {Object} config - Configuration object
 * @param {string} config.feeTier - '005' or '030'
 * @param {string} config.timing - 'always' or 'sma'
 * @param {boolean} config.hedge - Whether to use hedge
 * @param {string} config.offMode - 'A' (swap to WBTC in OFF) or 'B' (conserve positions)
 * @param {number} config.gasOverride - Override gas cost USD (null = use defaults)
 * @param {number} config.slippage - Slippage per swap (default 0.001)
 * @returns {Object} Backtest results
 */
export function runBacktest(data, config) {
  const {
    feeTier = '005',
    timing = 'always',
    hedge = true,
    offMode = 'B',
    gasOverride = null,
    slippage = DEFAULT_SLIPPAGE,
  } = config;

  const swapFee = feeTier === '005' ? SWAP_FEE_005 : SWAP_FEE_030;
  const apyKey = feeTier === '005' ? 'apy_005' : 'apy_030';

  let btc = START_BTC;
  let peak = START_BTC;
  let maxDD = 0;
  let rangeCenter = null;
  let wasOn = false;
  let rebalanceCount = 0;

  // Cumulative tracking
  let totalFees = 0;
  let totalHedge = 0;
  let totalIL = 0;
  let totalGas = 0;
  let totalSlippage = 0;
  let totalSwapFees = 0;
  let totalPerpFees = 0;

  // Per-position tracking
  const positions = [];
  let currentPosition = null;

  // Daily series for chart
  const series = [];

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const date = d.date;
    const ethbtc = d.ethbtc;
    const apy = d[apyKey];
    const fundingRate = d.funding;
    const btcPrice = d.btc_price || 85000;

    const on = isPoolOn(date, timing) && ethbtc != null && apy != null;

    // ─── Transition OFF → ON ────────────────────────────────
    if (on && !wasOn) {
      // Enter pool: set range center
      rangeCenter = ethbtc;

      // If mode A was active (we swapped all to WBTC), swap back to 50/50
      if (offMode === 'A' && wasOn === false && positions.length > 0) {
        const slippageCost = btc * slippage;
        const swapFeeCost = btc * 0.5 * swapFee; // swap ~50% to WETH
        btc -= slippageCost;
        btc -= swapFeeCost;
        totalSlippage += slippageCost;
        totalSwapFees += swapFeeCost;
      }

      // Open new position
      currentPosition = {
        entryDate: date,
        exitDate: null,
        entryPrice: ethbtc,
        exitPrice: null,
        entryBtc: btc,
        exitBtc: null,
        fees: 0,
        hedgePnl: 0,
        il: 0,
        gas: 0,
        slippage: 0,
        swapFees: 0,
        perpFees: 0,
        rebalances: 0,
        entryWbtcPct: 0.5,
        entryWethPct: 0.5,
        exitWbtcPct: null,
        exitWethPct: null,
      };

      // If hedge, pay perp fee to open short
      if (hedge) {
        const perpFee = btc * HEDGE_RATIO * PERP_FEE;
        btc -= perpFee;
        totalPerpFees += perpFee;
        if (currentPosition) currentPosition.perpFees += perpFee;
      }
    }

    // ─── Transition ON → OFF ────────────────────────────────
    if (!on && wasOn && currentPosition) {
      // Close position
      currentPosition.exitDate = date;
      currentPosition.exitPrice = ethbtc || currentPosition.entryPrice;
      currentPosition.exitBtc = btc;

      // Calculate exit token composition
      if (ethbtc && rangeCenter) {
        const r = ethbtc / rangeCenter;
        // If ETH went up → more WBTC, if down → more WETH
        currentPosition.exitWbtcPct = Math.min(1, Math.max(0, 0.5 + (r - 1) * 2.5));
        currentPosition.exitWethPct = 1 - currentPosition.exitWbtcPct;
      }

      // If mode A: swap everything to WBTC
      if (offMode === 'A') {
        const slippageCost = btc * slippage;
        const swapFeeCost = btc * 0.5 * swapFee;
        btc -= slippageCost;
        btc -= swapFeeCost;
        totalSlippage += slippageCost;
        totalSwapFees += swapFeeCost;
      }

      // Close hedge if active
      if (hedge) {
        const perpFee = btc * HEDGE_RATIO * PERP_FEE;
        btc -= perpFee;
        totalPerpFees += perpFee;
        currentPosition.perpFees += perpFee;
      }

      positions.push(currentPosition);
      currentPosition = null;
      rangeCenter = null;
    }

    // ─── Daily logic when ON ────────────────────────────────
    if (on && ethbtc != null && apy != null) {
      // Fee income
      const dr = dailyRate(apy);
      const feeIncome = btc * dr * MULTIPLIER;
      btc += feeIncome;
      totalFees += feeIncome;
      if (currentPosition) currentPosition.fees += feeIncome;

      // Hedge income (funding)
      if (hedge && fundingRate != null) {
        const hedgeIncome = btc * HEDGE_RATIO * (fundingRate / 100 / 365);
        btc += hedgeIncome;
        totalHedge += hedgeIncome;
        if (currentPosition) currentPosition.hedgePnl += hedgeIncome;
      }

      // Check rebalance trigger
      if (rangeCenter != null) {
        const drift = Math.abs(ethbtc / rangeCenter - 1);
        if (drift >= REBALANCE_THRESHOLD) {
          // IL
          const r = ethbtc / rangeCenter;
          const ilPct = calcIL(r);
          const ilCost = Math.abs(btc * ilPct);
          btc -= ilCost;
          totalIL += ilCost;
          if (currentPosition) currentPosition.il += ilCost;

          // Gas (2 txs: exit + enter)
          const gasUsd = getGasCostUSD(date, gasOverride);
          const gasCost = (gasUsd * 2) / btcPrice;
          btc -= gasCost;
          totalGas += gasCost;
          if (currentPosition) currentPosition.gas += gasCost;

          // Slippage on recomposition
          const slippageCost = btc * slippage;
          btc -= slippageCost;
          totalSlippage += slippageCost;
          if (currentPosition) currentPosition.slippage += slippageCost;

          // Swap fee on recomposition
          const swapFeeCost = btc * 0.5 * swapFee;
          btc -= swapFeeCost;
          totalSwapFees += swapFeeCost;
          if (currentPosition) currentPosition.swapFees += swapFeeCost;

          // Perp fee on hedge rebalance
          if (hedge) {
            const perpFee = btc * HEDGE_RATIO * PERP_FEE;
            btc -= perpFee;
            totalPerpFees += perpFee;
            if (currentPosition) currentPosition.perpFees += perpFee;
          }

          // Re-center
          rangeCenter = ethbtc;
          rebalanceCount++;
          if (currentPosition) currentPosition.rebalances++;
        }
      }
    }

    // Track drawdown
    if (btc > peak) peak = btc;
    const dd = (btc - peak) / peak;
    if (dd < maxDD) maxDD = dd;

    wasOn = on;

    // Build series entry
    series.push({
      date,
      btc: parseFloat(btc.toFixed(6)),
      ethbtc: ethbtc || null,
      apy: apy || null,
      funding: fundingRate || null,
      on,
      rangeCenter: rangeCenter ? parseFloat(rangeCenter.toFixed(8)) : null,
      rangeLower: rangeCenter ? parseFloat((rangeCenter * (1 - RANGE_WIDTH)).toFixed(8)) : null,
      rangeUpper: rangeCenter ? parseFloat((rangeCenter * (1 + RANGE_WIDTH)).toFixed(8)) : null,
    });
  }

  // Close final position if still open
  if (currentPosition) {
    const lastData = data[data.length - 1];
    currentPosition.exitDate = lastData.date;
    currentPosition.exitPrice = lastData.ethbtc || currentPosition.entryPrice;
    currentPosition.exitBtc = btc;
    positions.push(currentPosition);
  }

  // Calculate metrics
  const totalDays = series.length;
  const activeDays = series.filter(s => s.on).length;
  const years = totalDays / 365;
  const finalBtc = btc;
  const netGain = finalBtc - START_BTC;
  const cagr = (Math.pow(finalBtc / START_BTC, 1 / years) - 1) * 100;
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
    config: { feeTier, timing, hedge, offMode, gasOverride, slippage },
  };
}

/**
 * Generate scenario key
 */
export function scenarioKey(config) {
  const fee = config.feeTier === '005' ? '0.05%' : '0.30%';
  const timing = config.timing === 'always' ? 'Always On' : 'SMA Timing';
  const hedge = config.hedge ? 'Hedge' : 'No Hedge';
  return `${fee} / ${timing} / ${hedge}`;
}

/**
 * Run all 8 base scenarios
 */
export function runAllScenarios(data, gasOverride = null, slippage = DEFAULT_SLIPPAGE) {
  const configs = [];
  for (const feeTier of ['005', '030']) {
    for (const timing of ['always', 'sma']) {
      for (const hedge of [true, false]) {
        configs.push({ feeTier, timing, hedge, offMode: 'B', gasOverride, slippage });
      }
    }
  }
  return configs.map(config => ({
    key: scenarioKey(config),
    result: runBacktest(data, config),
  }));
}
