import { useState, useEffect, useMemo, useCallback } from 'react';
import { runBacktest, runAllScenarios, runHybridBacktest, simulateWithdrawals, MITIGANT_PRESETS } from './engine';
import MainChart from './components/MainChart';
import ConfigPanel from './components/ConfigPanel';
import CostSummary from './components/CostSummary';
import MetricsBar from './components/MetricsBar';
import PositionCards from './components/PositionCards';
import PriceRangeChart from './components/PriceRangeChart';
import FundingChart from './components/FundingChart';
import ScenarioTable from './components/ScenarioTable';
import WithdrawalChart from './components/WithdrawalChart';
import HybridChart from './components/HybridChart';
import HedgeAnalysis from './components/HedgeAnalysis';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Strategy controls
  const [feeTier, setFeeTier] = useState('005');
  const [timing, setTiming] = useState('always');
  const [hedge, setHedge] = useState(true);
  const [offMode, setOffMode] = useState('B');
  const [benchmark, setBenchmark] = useState('btc');
  const [withdrawal, setWithdrawal] = useState('none');
  const [gasOverride, setGasOverride] = useState(null);
  const [slippage, setSlippage] = useState(0.001);
  const [rebalanceDelay, setRebalanceDelay] = useState(4); // 4d per Addendum 5 recommended

  // V4 Hedge Engine controls — defaults from Recommended preset
  const [leverage, setLeverage] = useState(4.0);
  const [marginThreshold, setMarginThreshold] = useState(0.30);
  const [cooldownDays, setCooldownDays] = useState(2);
  const [exchange, setExchange] = useState('hl');

  // V4.5 Mitigant controls — defaults from Recommended preset
  const [maxStopsPerWindow, setMaxStopsPerWindow] = useState(1);
  const [stopWindowDays, setStopWindowDays] = useState(60);
  const [ethbtcSmaFilter, setEthbtcSmaFilter] = useState(false);
  const [ethbtcSmaPeriod, setEthbtcSmaPeriod] = useState(30);
  const [progressiveDehedge, setProgressiveDehedge] = useState(true);
  const [expCooldown, setExpCooldown] = useState(true);
  const [baseCooldownDays, setBaseCooldownDays] = useState(3);

  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetch('/unified_data.json')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // Apply preset
  const handleApplyPreset = useCallback((key) => {
    const p = MITIGANT_PRESETS[key];
    if (!p) return;
    setLeverage(p.leverage);
    setMarginThreshold(p.marginThreshold);
    setRebalanceDelay(p.rebalanceDelay);
    setCooldownDays(p.cooldownDays);
    setMaxStopsPerWindow(p.maxStopsPerWindow);
    setStopWindowDays(p.stopWindowDays);
    setEthbtcSmaFilter(p.ethbtcSmaFilter);
    setEthbtcSmaPeriod(p.ethbtcSmaPeriod);
    setProgressiveDehedge(p.progressiveDehedge);
    setExpCooldown(p.expCooldown);
    setBaseCooldownDays(p.baseCooldownDays);
  }, []);

  const config = useMemo(() => ({
    feeTier, timing, hedge, offMode, gasOverride, slippage, rebalanceDelay,
    leverage, marginThreshold, cooldownDays, exchange,
    maxStopsPerWindow, stopWindowDays, ethbtcSmaFilter, ethbtcSmaPeriod,
    progressiveDehedge, expCooldown, baseCooldownDays,
  }), [feeTier, timing, hedge, offMode, gasOverride, slippage, rebalanceDelay,
       leverage, marginThreshold, cooldownDays, exchange,
       maxStopsPerWindow, stopWindowDays, ethbtcSmaFilter, ethbtcSmaPeriod,
       progressiveDehedge, expCooldown, baseCooldownDays]);

  const mitigantConfig = useMemo(() => ({
    maxStopsPerWindow, stopWindowDays, ethbtcSmaFilter, ethbtcSmaPeriod,
    progressiveDehedge, expCooldown, baseCooldownDays,
  }), [maxStopsPerWindow, stopWindowDays, ethbtcSmaFilter, ethbtcSmaPeriod,
       progressiveDehedge, expCooldown, baseCooldownDays]);

  const result = useMemo(() => {
    if (!data) return null;
    return runBacktest(data, config);
  }, [data, config]);

  const withdrawalResult = useMemo(() => {
    if (!result || withdrawal === 'none') return null;
    return simulateWithdrawals(result.series, withdrawal);
  }, [result, withdrawal]);

  const allScenarios = useMemo(() => {
    if (!data) return [];
    return runAllScenarios(data, gasOverride, slippage, rebalanceDelay, leverage, marginThreshold, cooldownDays, exchange, mitigantConfig);
  }, [data, gasOverride, slippage, rebalanceDelay, leverage, marginThreshold, cooldownDays, exchange, mitigantConfig]);

  const hybridResult = useMemo(() => {
    if (!data) return null;
    return runHybridBacktest(data, { timing, offMode, gasOverride, slippage, rebalanceDelay, leverage, marginThreshold, cooldownDays, exchange, ...mitigantConfig });
  }, [data, timing, offMode, gasOverride, slippage, rebalanceDelay, leverage, marginThreshold, cooldownDays, exchange, mitigantConfig]);

  const arbOnlyResult = useMemo(() => {
    if (!data) return null;
    return runBacktest(data, { ...config, feeTier: '005', hedge: true });
  }, [data, config]);

  const ethOnlyResult = useMemo(() => {
    if (!data) return null;
    return runBacktest(data, { ...config, feeTier: '030', hedge: true });
  }, [data, config]);

  const btcUsd = result?.series?.[result.series.length - 1]?.btcUsd || 85000;
  const totalDays = result?.series?.length || 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#f7931a] border-t-transparent animate-spin mx-auto" />
          <div className="text-[#8888a8] text-sm font-medium">Loading real data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#ef4444] bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)] rounded-2xl px-8 py-5 text-sm">Error: {error}</div>
      </div>
    );
  }

  const mitigantActive = maxStopsPerWindow < Infinity || ethbtcSmaFilter || progressiveDehedge || expCooldown;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'price', label: 'Price & Ranges' },
    { id: 'positions', label: 'Positions' },
    { id: 'funding', label: 'Funding & APY' },
    ...(hedge ? [{ id: 'hedge', label: 'Hedge Analysis' }] : []),
    { id: 'scenarios', label: 'Scenarios' },
    { id: 'withdrawal', label: 'Withdrawals' },
    { id: 'hybrid', label: 'Hybrid 50/50' },
  ];

  return (
    <div className="min-h-screen max-w-[1480px] mx-auto px-8 py-10">
      {/* Header */}
      <header className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f7931a] to-[#d97706] flex items-center justify-center text-white font-bold text-xl shadow-[0_0_30px_rgba(247,147,26,0.15)]">
            D
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#f0f0f8] tracking-tight">DeltaYield V4</h1>
            <p className="text-sm text-[#555570] mt-1">
              WBTC/WETH CLP — {hedge ? `${leverage}x / ${(marginThreshold*100).toFixed(0)}% margin stop` : 'Unhedged'}
              {mitigantActive && <span className="text-[#22c55e] ml-1">+ Mitigants</span>}
              {' '} — Real Data Only
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#555570] bg-[#0a0a14] border border-[#1a1a2e] rounded-xl px-4 py-2.5 font-medium">
            {benchmark === 'usd' ? `1 BTC = $${btcUsd.toLocaleString()}` : `${totalDays.toLocaleString()} days of real data`}
          </span>
          <span className="flex items-center gap-2 text-xs text-[#555570]">
            <span className="inline-block w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            V4.5 Engine
          </span>
        </div>
      </header>

      {/* Config */}
      <ConfigPanel
        feeTier={feeTier} setFeeTier={setFeeTier}
        timing={timing} setTiming={setTiming}
        hedge={hedge} setHedge={setHedge}
        offMode={offMode} setOffMode={setOffMode}
        benchmark={benchmark} setBenchmark={setBenchmark}
        withdrawal={withdrawal} setWithdrawal={setWithdrawal}
        gasOverride={gasOverride} setGasOverride={setGasOverride}
        slippage={slippage} setSlippage={setSlippage}
        rebalanceDelay={rebalanceDelay} setRebalanceDelay={setRebalanceDelay}
        leverage={leverage} setLeverage={setLeverage}
        marginThreshold={marginThreshold} setMarginThreshold={setMarginThreshold}
        cooldownDays={cooldownDays} setCooldownDays={setCooldownDays}
        exchange={exchange} setExchange={setExchange}
        maxStopsPerWindow={maxStopsPerWindow} setMaxStopsPerWindow={setMaxStopsPerWindow}
        stopWindowDays={stopWindowDays} setStopWindowDays={setStopWindowDays}
        ethbtcSmaFilter={ethbtcSmaFilter} setEthbtcSmaFilter={setEthbtcSmaFilter}
        ethbtcSmaPeriod={ethbtcSmaPeriod} setEthbtcSmaPeriod={setEthbtcSmaPeriod}
        progressiveDehedge={progressiveDehedge} setProgressiveDehedge={setProgressiveDehedge}
        expCooldown={expCooldown} setExpCooldown={setExpCooldown}
        baseCooldownDays={baseCooldownDays} setBaseCooldownDays={setBaseCooldownDays}
        onApplyPreset={handleApplyPreset}
      />

      {/* Metrics */}
      {result && <MetricsBar metrics={result.metrics} costs={result.costs} benchmark={benchmark} btcUsd={btcUsd} />}

      {/* Tab Navigation */}
      <nav className="flex gap-1 mb-10 bg-[#0a0a14] border border-[#1a1a2e] rounded-xl p-1.5 w-fit overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-[13px] font-semibold rounded-lg transition-all duration-200 whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#f7931a] text-black shadow-[0_2px_12px_rgba(247,147,26,0.3)]'
                : 'text-[#555570] hover:text-[#f0f0f8] hover:bg-[rgba(255,255,255,0.04)]'
            }`}>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      {result && (
        <div className="min-h-[500px]">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2"><MainChart series={result.series} benchmark={benchmark} withdrawal={withdrawal} withdrawalResult={withdrawalResult} /></div>
                <div><CostSummary costs={result.costs} metrics={result.metrics} benchmark={benchmark} btcUsd={btcUsd} /></div>
              </div>
            </div>
          )}
          {activeTab === 'price' && <PriceRangeChart series={result.series} />}
          {activeTab === 'positions' && <PositionCards positions={result.positions} benchmark={benchmark} btcUsd={btcUsd} />}
          {activeTab === 'funding' && <FundingChart series={result.series} />}
          {activeTab === 'hedge' && hedge && (
            <HedgeAnalysis series={result.series} metrics={result.metrics} costs={result.costs} benchmark={benchmark} />
          )}
          {activeTab === 'scenarios' && <ScenarioTable scenarios={allScenarios} benchmark={benchmark} btcUsd={btcUsd} />}
          {activeTab === 'withdrawal' && <WithdrawalChart series={result.series} benchmark={benchmark} />}
          {activeTab === 'hybrid' && hybridResult && arbOnlyResult && ethOnlyResult && (
            <HybridChart hybridResult={hybridResult} arbOnlyResult={arbOnlyResult} ethOnlyResult={ethOnlyResult} benchmark={benchmark} />
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 py-6 border-t border-[#1a1a2e] flex items-center justify-between text-xs text-[#555570]">
        <span>DeltaYield V4.5 — Zero synthetic data — Daily BTC/USD — {benchmark === 'usd' ? 'USD Mode' : 'BTC Benchmark'}</span>
        <span>The Graph + Binance + Hyperliquid — Real daily prices</span>
      </footer>
    </div>
  );
}
