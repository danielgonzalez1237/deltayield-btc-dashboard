import { useState } from 'react';

function PillToggle({ label, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      <span className="text-[10px] text-[#4e4e66] font-semibold uppercase tracking-[0.08em]">{label}</span>
      <div className="flex bg-[#0c0c14] border border-[#1f1f30] rounded-lg p-[3px] gap-[2px]">
        {options.map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-[6px] text-[11px] font-medium rounded-md transition-all duration-200 ${
              value === opt.value
                ? 'bg-[#f7931a] text-black shadow-[0_2px_8px_rgba(247,147,26,0.25)]'
                : 'text-[#7a7a96] hover:text-[#eaeaf2] hover:bg-[rgba(255,255,255,0.03)]'
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
}) {
  const [gasOpen, setGasOpen] = useState(false);

  return (
    <div className="bg-[#111119] border border-[#1f1f30] rounded-2xl p-5 mb-5">
      <div className="flex flex-wrap gap-5 items-end">
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
        <PillToggle label="Withdrawals" value={withdrawal} onChange={setWithdrawal}
          options={[
            { value: 'none', label: 'Compound' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'quarterly', label: 'Quarterly' },
            { value: 'semiannual', label: 'Semi' },
            { value: 'annual', label: 'Annual' },
          ]} />

        <div className="w-px h-10 bg-[#1f1f30] hidden md:block" />

        {/* Gas */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-[#4e4e66] font-semibold uppercase tracking-[0.08em]">Gas</span>
          <button onClick={() => setGasOpen(!gasOpen)}
            className={`flex items-center gap-1.5 px-3 py-[6px] text-[11px] font-medium rounded-lg border transition-all duration-200 ${
              gasOverride !== null
                ? 'border-[#f7931a] bg-[rgba(247,147,26,0.08)] text-[#f7931a]'
                : 'border-[#1f1f30] bg-[#0c0c14] text-[#7a7a96] hover:text-[#eaeaf2]'
            }`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            {gasOverride !== null ? `$${gasOverride.toFixed(2)}/tx` : 'Default'}
          </button>
        </div>

        {/* Slippage */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-[#4e4e66] font-semibold uppercase tracking-[0.08em]">Slippage</span>
          <div className="flex items-center gap-2.5 bg-[#0c0c14] border border-[#1f1f30] rounded-lg px-3 py-[5px]">
            <input type="range" min="0" max="50" value={slippage * 10000}
              onChange={e => setSlippage(parseInt(e.target.value) / 10000)} className="w-16" />
            <span className="text-[11px] font-mono text-[#eaeaf2] tabular-nums min-w-[40px] text-right">
              {(slippage * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {gasOpen && (
        <div className="mt-4 pt-4 border-t border-[#1f1f30] space-y-3">
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-[#7a7a96]">Gas override (all chains):</span>
            <input type="range" min="0" max="500"
              value={gasOverride !== null ? gasOverride * 100 : 0}
              onChange={e => { const v = parseInt(e.target.value) / 100; setGasOverride(v > 0 ? v : null); }}
              className="flex-1 max-w-[240px]" />
            <span className="text-[11px] font-mono text-[#eaeaf2] tabular-nums min-w-[60px]">
              ${gasOverride !== null ? gasOverride.toFixed(2) : 'auto'}
            </span>
            <button onClick={() => setGasOverride(null)}
              className="text-[10px] text-[#7a7a96] hover:text-[#f7931a] transition-colors px-2 py-1 rounded border border-[#1f1f30] hover:border-[#f7931a]">
              Reset
            </button>
          </div>
          <div className="flex gap-4 text-[10px] text-[#4e4e66]">
            <span className="font-semibold text-[#7a7a96]">ARB:</span>
            <span>2021: $3</span><span>2022: $1.50</span><span>2023: $0.84</span><span>2024+: $0.03</span>
            <span className="ml-3 font-semibold text-[#7a7a96]">ETH:</span>
            <span>2021: $50</span><span>2022: $20</span><span>2023: $10</span><span>2024: $5</span><span>2025+: $3</span>
          </div>
        </div>
      )}
    </div>
  );
}
