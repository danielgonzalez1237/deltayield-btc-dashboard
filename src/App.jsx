import { useState, useEffect, useMemo } from 'react';
import { runBacktest, runAllScenarios } from './engine';
import MainChart from './components/MainChart';
import ConfigPanel from './components/ConfigPanel';
import CostSummary from './components/CostSummary';
import MetricsBar from './components/MetricsBar';
import PositionCards from './components/PositionCards';
import PriceRangeChart from './components/PriceRangeChart';
import FundingChart from './components/FundingChart';
import ScenarioTable from './components/ScenarioTable';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [feeTier, setFeeTier] = useState('005');
  const [timing, setTiming] = useState('always');
  const [hedge, setHedge] = useState(true);
  const [offMode, setOffMode] = useState('B');
  const [benchmark, setBenchmark] = useState('btc');
  const [gasOverride, setGasOverride] = useState(null);
  const [slippage, setSlippage] = useState(0.001);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetch('/unified_data.json')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const result = useMemo(() => {
    if (!data) return null;
    return runBacktest(data, { feeTier, timing, hedge, offMode, gasOverride, slippage });
  }, [data, feeTier, timing, hedge, offMode, gasOverride, slippage]);

  const allScenarios = useMemo(() => {
    if (!data) return [];
    return runAllScenarios(data, gasOverride, slippage);
  }, [data, gasOverride, slippage]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#f7931a] border-t-transparent animate-spin mx-auto" />
          <div className="text-[#7a7a96] text-sm">Loading real data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#f87171] bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.2)] rounded-xl px-6 py-4">Error: {error}</div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '◎' },
    { id: 'price', label: 'Price & Ranges', icon: '◇' },
    { id: 'positions', label: 'Positions', icon: '▦' },
    { id: 'funding', label: 'Funding & APY', icon: '⟡' },
    { id: 'scenarios', label: 'Scenarios', icon: '⊞' },
  ];

  return (
    <div className="min-h-screen max-w-[1400px] mx-auto px-5 py-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-7">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f7931a] to-[#e67e00] flex items-center justify-center text-black font-bold text-lg shadow-[0_0_20px_rgba(247,147,26,0.2)]">
            D
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#eaeaf2] tracking-tight">
              DeltaYield V3
            </h1>
            <p className="text-xs text-[#7a7a96] mt-0.5">
              WBTC/WETH Concentrated Liquidity — Real Data Only
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#4e4e66]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
          Live backtest engine
        </div>
      </header>

      {/* Config + Metrics in a unified section */}
      <ConfigPanel
        feeTier={feeTier} setFeeTier={setFeeTier}
        timing={timing} setTiming={setTiming}
        hedge={hedge} setHedge={setHedge}
        offMode={offMode} setOffMode={setOffMode}
        benchmark={benchmark} setBenchmark={setBenchmark}
        gasOverride={gasOverride} setGasOverride={setGasOverride}
        slippage={slippage} setSlippage={setSlippage}
      />

      {result && <MetricsBar metrics={result.metrics} costs={result.costs} />}

      {/* Tabs */}
      <nav className="flex gap-0.5 mb-5 bg-[#0c0c14] rounded-xl p-1 border border-[#1f1f30] w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-[#111119] text-[#f7931a] shadow-[0_1px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]'
                : 'text-[#7a7a96] hover:text-[#eaeaf2] hover:bg-[rgba(255,255,255,0.02)]'
            }`}
          >
            <span className="mr-1.5 opacity-60">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      {result && (
        <>
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="xl:col-span-2">
                <MainChart series={result.series} benchmark={benchmark} />
              </div>
              <div>
                <CostSummary costs={result.costs} metrics={result.metrics} />
              </div>
            </div>
          )}
          {activeTab === 'price' && <PriceRangeChart series={result.series} />}
          {activeTab === 'positions' && <PositionCards positions={result.positions} />}
          {activeTab === 'funding' && <FundingChart series={result.series} />}
          {activeTab === 'scenarios' && <ScenarioTable scenarios={allScenarios} />}
        </>
      )}

      {/* Footer */}
      <footer className="mt-14 py-5 border-t border-[#1f1f30] flex items-center justify-between text-[10px] text-[#4e4e66]">
        <span>DeltaYield V3 — Zero synthetic data</span>
        <span>The Graph + Binance + Hyperliquid</span>
      </footer>
    </div>
  );
}
