import { useState } from 'react';

function PillToggle({ label, value, onChange, options }) {
  return (
    <div className="space-y-3">
      <span className="text-[11px] text-[#555570] font-semibold uppercase tracking-[0.12em] block">{label}</span>
      <div className="inline-flex bg-[#0a0a14] border border-[#1a1a2e] rounded-xl p-1 gap-1">
        {options.map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2 text-[12px] font-semibold rounded-lg transition-all duration-200 whitespace-nowrap ${
              value === opt.value
                ? 'bg-[#f7931a] text-black shadow-[0_2px_12px_rgba(247,147,26,0.3)]'
                : 'text-[#8888a8] hover:text-[#f0f0f8] hover:bg-[rgba(255,255,255,0.04)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ConfigPanel({
  feeTier, setFeeTier,
  timing, setTiming,
  hedge, setHedge,
  offMode, setOffMode,
  benchmark, setBenchmark,
  withdrawal, setWithdrawal,
  gasOverride, setGasOverride,
  slippage, setSlippage,
  rebalanceDelay, setRebalanceDelay,
}) {
  const [gasOpen, setGasOpen] = useState(false);

  return (
    <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-3xl p-8 mb-10">
      {/* Row 1: Strategy controls */}
      <div className="flex flex-wrap gap-8 items-end">
        <PillToggle label="Fee Tier" value={feeTier} onChange={setFeeTier}
          options={[{ value: '005', label: '0.05% ARB' }, { value: '030', label: '0.30% ETH' }]} />
        <PillToggle label="Timing" value={timing} onChange={setTiming}
          options={[{ value: 'always', label: 'Always On' }, { value: 'sma', label: 'SMA Timing' }]} />
        <PillToggle label="Hedge" value={hedge} onChange={v => setHedge(v)}
          options={[{ value: true, label: 'With Hedge' }, { value: false, label: 'No Hedge' }]} />
        <PillToggle label="Off Mode" value={offMode} onChange={setOffMode}
          options={[{ value: 'A', label: 'A: WBTC' }, { value: 'B', label: 'B: Conserve' }]} />
        <PillToggle label="Benchmark" value={benchmark} onChange={setBenchmark}
          options={[{ value: 'btc', label: 'BTC' }, { value: 'usd', label: 'USD' }]} />
      </div>

      {/* Row 2: Withdrawal + Advanced */}
      <div className="flex flex-wrap gap-8 items-end mt-8 pt-8 border-t border-[#1a1a2e]/50">
        <PillToggle label="Withdrawals" value={withdrawal} onChange={setWithdrawal}
          options={[
            { value: 'none', label: 'Compound' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'quarterly', label: 'Quarterly' },
            { value: 'semiannual', label: 'Semi' },
            { value: 'annual', label: 'Annual' },
          ]} />

        <div className="w-px h-12 bg-[#1a1a2e] hidden lg:block self-center" />

        {/* Gas */}
        <div className="space-y-3">
          <span className="text-[11px] text-[#555570] font-semibold uppercase tracking-[0.12em] block">Gas</span>
          <button onClick={() => setGasOpen(!gasOpen)}
            className={`flex items-center gap-3 px-4 py-2 text-[12px] font-semibold rounded-xl border transition-all duration-200 ${
              gasOverride !== null
                ? 'border-[#f7931a] bg-[rgba(247,147,26,0.06)] text-[#f7931a]'
                : 'border-[#1a1a2e] bg-[#0a0a14] text-[#8888a8] hover:text-[#f0f0f8]'
            }`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            {gasOverride !== null ? `$${gasOverride.toFixed(2)}/tx` : 'Default'}
          </button>
        </div>

        {/* Slippage */}
        <div className="space-y-3">
          <span className="text-[11px] text-[#555570] font-semibold uppercase tracking-[0.12em] block">Slippage</span>
          <div className="flex items-center gap-4 bg-[#0a0a14] border border-[#1a1a2e] rounded-xl px-4 py-2">
            <input type="range" min="0" max="50" value={slippage * 10000}
              onChange={e => setSlippage(parseInt(e.target.value) / 10000)} className="w-28" />
            <span className="text-[12px] font-mono text-[#f0f0f8] tabular-nums min-w-[50px] text-right font-semibold">
              {(slippage * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Rebalance Delay + Swap Fee */}
      <div className="flex flex-wrap gap-8 items-end mt-8 pt-8 border-t border-[#1a1a2e]/50">
        <PillToggle label="Rebalance Delay" value={rebalanceDelay} onChange={setRebalanceDelay}
          options={[
            { value: 0, label: 'Instant' },
            { value: 1, label: '24h' },
            { value: 2, label: '48h' },
            { value: 3, label: '72h' },
            { value: 4, label: '96h' },
          ]} />

        <div className="w-px h-12 bg-[#1a1a2e] hidden lg:block self-center" />

        {/* Swap Fee (read-only, derived from fee tier) */}
        <div className="space-y-3">
          <span className="text-[11px] text-[#555570] font-semibold uppercase tracking-[0.12em] block">Swap Fee</span>
          <div className="flex items-center gap-3 px-4 py-2 text-[12px] font-semibold rounded-xl border border-[#1a1a2e] bg-[#0a0a14] text-[#8888a8]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            {feeTier === '005' ? '0.05%' : '0.30%'} per swap
          </div>
        </div>
      </div>

      {/* Gas expanded panel */}
      {gasOpen && (
        <div className="mt-8 pt-8 border-t border-[#1a1a2e]/50 space-y-5">
          <div className="flex items-center gap-6">
            <span className="text-[12px] text-[#8888a8]">Gas override (all chains):</span>
            <input type="range" min="0" max="500"
              value={gasOverride !== null ? gasOverride * 100 : 0}
              onChange={e => { const v = parseInt(e.target.value) / 100; setGasOverride(v > 0 ? v : null); }}
              className="flex-1 max-w-[280px]" />
            <span className="text-[12px] font-mono text-[#f0f0f8] tabular-nums min-w-[65px] font-semibold">
              ${gasOverride !== null ? gasOverride.toFixed(2) : 'auto'}
            </span>
            <button onClick={() => setGasOverride(null)}
              className="text-[11px] text-[#8888a8] hover:text-[#f7931a] transition-colors px-4 py-2 rounded-xl border border-[#1a1a2e] hover:border-[#f7931a]">
              Reset
            </button>
          </div>
          <div className="flex gap-6 text-[11px] text-[#555570] flex-wrap">
            <span className="font-semibold text-[#8888a8]">ARB:</span>
            <span>2021: $3</span><span>2022: $1.50</span><span>2023: $0.84</span><span>2024+: $0.03</span>
            <span className="ml-6 font-semibold text-[#8888a8]">ETH:</span>
            <span>2021: $50</span><span>2022: $20</span><span>2023: $10</span><span>2024: $5</span><span>2025+: $3</span>
          </div>
        </div>
      )}
    </div>
  );
}
