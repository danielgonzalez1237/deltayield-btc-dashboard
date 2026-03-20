import { useState } from 'react';
import { MITIGANT_PRESETS } from '../engine';

function PillToggle({ label, value, onChange, options, disabled, compact }) {
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <span className="text-[13px] text-[#555570] font-semibold uppercase tracking-[0.12em] block">{label}</span>
      <div className={`inline-flex bg-[#0a0a14] border border-[#1a1a2e] rounded-xl p-1 gap-0.5 flex-wrap ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        {options.map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            disabled={disabled}
            className={`${compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-4 py-2 text-[12px]'} font-semibold rounded-lg transition-all duration-200 whitespace-nowrap ${
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

function MitigantToggle({ id, label, description, enabled, onToggle, children }) {
  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 ${
      enabled
        ? 'border-[#22c55e]/30 bg-[rgba(34,197,94,0.04)]'
        : 'border-[#1a1a2e] bg-[#0a0a14]'
    }`}>
      <div className="flex items-start gap-3">
        <button onClick={onToggle}
          className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
            enabled
              ? 'border-[#22c55e] bg-[#22c55e]'
              : 'border-[#555570] hover:border-[#8888a8]'
          }`}>
          {enabled && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-[#f0f0f8] uppercase tracking-wider">{id}</span>
            <span className="text-[12px] font-semibold text-[#8888a8]">{label}</span>
          </div>
          <p className="text-[11px] text-[#555570] mt-1 leading-relaxed">{description}</p>
          {enabled && children && <div className="mt-3 flex items-center gap-4">{children}</div>}
        </div>
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
  leverage, setLeverage,
  marginThreshold, setMarginThreshold,
  cooldownDays, setCooldownDays,
  exchange, setExchange,
  // Mitigant props
  maxStopsPerWindow, setMaxStopsPerWindow,
  stopWindowDays, setStopWindowDays,
  ethbtcSmaFilter, setEthbtcSmaFilter,
  ethbtcSmaPeriod, setEthbtcSmaPeriod,
  progressiveDehedge, setProgressiveDehedge,
  expCooldown, setExpCooldown,
  // Preset
  onApplyPreset,
}) {
  const [gasOpen, setGasOpen] = useState(false);
  const [hedgeOpen, setHedgeOpen] = useState(true);
  const [mitigantOpen, setMitigantOpen] = useState(true);

  const m1Active = maxStopsPerWindow < Infinity;

  // Detect current preset
  const currentPreset = Object.entries(MITIGANT_PRESETS).find(([, p]) =>
    p.leverage === leverage && p.marginThreshold === marginThreshold &&
    p.rebalanceDelay === rebalanceDelay && p.cooldownDays === cooldownDays &&
    p.progressiveDehedge === progressiveDehedge && p.expCooldown === expCooldown &&
    (p.maxStopsPerWindow === Infinity ? !m1Active : m1Active && p.maxStopsPerWindow === maxStopsPerWindow)
  );
  const presetKey = currentPreset ? currentPreset[0] : 'custom';

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

      {/* Row 2: Hedge Engine (collapsible) */}
      {hedge && (
        <div className="mt-8 pt-8 border-t border-[#1a1a2e]/50">
          <button onClick={() => setHedgeOpen(!hedgeOpen)}
            className="flex items-center gap-3 mb-6 group">
            <span className="text-[13px] text-[#555570] font-semibold uppercase tracking-[0.12em] group-hover:text-[#f0f0f8] transition-colors">
              Hedge Engine
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`text-[#555570] transition-transform duration-200 ${hedgeOpen ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
            <span className="text-[13px] text-[#8888a8] bg-[#0a0a14] border border-[#1a1a2e] rounded-lg px-3 py-1 font-mono">
              {leverage}x / {(marginThreshold * 100).toFixed(0)}% / {cooldownDays * 24}h
            </span>
          </button>

          {hedgeOpen && (
            <div className="flex flex-wrap gap-6 items-end">
              <PillToggle label="Leverage" value={leverage} onChange={setLeverage} compact
                options={[
                  { value: 1.0, label: '1x' },
                  { value: 1.5, label: '1.5x' },
                  { value: 2.0, label: '2x' },
                  { value: 2.5, label: '2.5x' },
                  { value: 3.0, label: '3x' },
                  { value: 3.5, label: '3.5x' },
                  { value: 4.0, label: '4x' },
                  { value: 5.0, label: '5x' },
                ]} />

              <div className="w-px h-10 bg-[#1a1a2e] hidden lg:block self-center" />

              <PillToggle label="Margin Stop" value={marginThreshold} onChange={setMarginThreshold} compact
                options={[
                  { value: 0.10, label: '10%' },
                  { value: 0.20, label: '20%' },
                  { value: 0.30, label: '30%' },
                  { value: 0.40, label: '40%' },
                  { value: 0.50, label: '50%' },
                  { value: 0.60, label: '60%' },
                  { value: 0.70, label: '70%' },
                  { value: 0.80, label: '80%' },
                ]} />

              <div className="w-px h-10 bg-[#1a1a2e] hidden lg:block self-center" />

              <PillToggle label="Cooldown" value={cooldownDays} onChange={setCooldownDays} compact
                options={[
                  { value: 0, label: '0h' },
                  { value: 1, label: '24h' },
                  { value: 2, label: '48h' },
                  { value: 3, label: '72h' },
                  { value: 4, label: '96h' },
                ]} />

              <div className="w-px h-10 bg-[#1a1a2e] hidden lg:block self-center" />

              <PillToggle label="Exchange" value={exchange} onChange={setExchange} compact
                options={[
                  { value: 'hl', label: 'Hyperliquid' },
                  { value: 'binance', label: 'Binance' },
                ]} />
            </div>
          )}
        </div>
      )}

      {/* Row 2.5: Hedge Mitigants */}
      {hedge && (
        <div className="mt-8 pt-8 border-t border-[#1a1a2e]/50">
          <button onClick={() => setMitigantOpen(!mitigantOpen)}
            className="flex items-center gap-3 mb-5 group">
            <span className="text-[13px] text-[#555570] font-semibold uppercase tracking-[0.12em] group-hover:text-[#f0f0f8] transition-colors">
              Hedge Mitigants
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`text-[#555570] transition-transform duration-200 ${mitigantOpen ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
            {(m1Active || progressiveDehedge || expCooldown || ethbtcSmaFilter) && (
              <span className="text-[11px] font-bold text-[#22c55e] bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] rounded-lg px-2.5 py-1">
                {[m1Active && 'M1', ethbtcSmaFilter && 'M2', progressiveDehedge && 'M3', expCooldown && 'M4'].filter(Boolean).join(' + ')}
              </span>
            )}
          </button>

          {mitigantOpen && (
            <div className="space-y-4">
              {/* Presets */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[11px] text-[#555570] font-semibold uppercase tracking-wider mr-2">Presets</span>
                {Object.entries(MITIGANT_PRESETS).map(([key, preset]) => (
                  <button key={key} onClick={() => onApplyPreset(key)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                      presetKey === key
                        ? 'bg-[#22c55e] text-black border-[#22c55e] shadow-[0_2px_8px_rgba(34,197,94,0.3)]'
                        : 'text-[#8888a8] border-[#1a1a2e] bg-[#0a0a14] hover:text-[#f0f0f8] hover:border-[#555570]'
                    }`}>
                    {preset.label}{key === 'recommended' ? ' *' : ''}
                  </button>
                ))}
                <button
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                    presetKey === 'custom'
                      ? 'bg-[#a855f7] text-black border-[#a855f7]'
                      : 'text-[#555570] border-[#1a1a2e] bg-[#0a0a14]'
                  }`}>
                  Custom
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* M1: Stop Cap */}
                <MitigantToggle
                  id="M1" label="Stop Cap" enabled={m1Active}
                  onToggle={() => setMaxStopsPerWindow(m1Active ? Infinity : 1)}
                  description="Cap margin stops per rolling window. Disables hedge after N stops in X days.">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[#8888a8]">Max stops:</span>
                    <select value={maxStopsPerWindow} onChange={e => setMaxStopsPerWindow(parseInt(e.target.value))}
                      className="bg-[#0a0a14] border border-[#1a1a2e] text-[11px] text-[#f0f0f8] rounded-lg px-2 py-1 font-mono">
                      {[1, 2, 3].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <span className="text-[11px] text-[#8888a8]">Window:</span>
                    <select value={stopWindowDays} onChange={e => setStopWindowDays(parseInt(e.target.value))}
                      className="bg-[#0a0a14] border border-[#1a1a2e] text-[11px] text-[#f0f0f8] rounded-lg px-2 py-1 font-mono">
                      {[30, 45, 60, 90, 120].map(v => <option key={v} value={v}>{v}d</option>)}
                    </select>
                  </div>
                </MitigantToggle>

                {/* M2: Trend Filter */}
                <MitigantToggle
                  id="M2" label="Trend Filter" enabled={ethbtcSmaFilter}
                  onToggle={() => setEthbtcSmaFilter(!ethbtcSmaFilter)}
                  description="Only hedge when ETHBTC < SMA (ETH underperforming BTC).">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[#8888a8]">SMA period:</span>
                    <select value={ethbtcSmaPeriod} onChange={e => setEthbtcSmaPeriod(parseInt(e.target.value))}
                      className="bg-[#0a0a14] border border-[#1a1a2e] text-[11px] text-[#f0f0f8] rounded-lg px-2 py-1 font-mono">
                      {[5, 10, 15, 20, 30, 50].map(v => <option key={v} value={v}>{v}d</option>)}
                    </select>
                  </div>
                </MitigantToggle>

                {/* M3: Progressive De-Hedging */}
                <MitigantToggle
                  id="M3" label="Progressive De-Hedge" enabled={progressiveDehedge}
                  onToggle={() => setProgressiveDehedge(!progressiveDehedge)}
                  description="Reduce hedge after consecutive stops: 50% > 30% > 15% > 0%. Resets on normal rebalance.">
                </MitigantToggle>

                {/* M4: Exponential Cooldown */}
                <MitigantToggle
                  id="M4" label="Exp Cooldown" enabled={expCooldown}
                  onToggle={() => setExpCooldown(!expCooldown)}
                  description="Double cooldown after each stop (cap 30d). Uses Cooldown pills as base. Resets on normal rebalance.">
                  {cooldownDays > 0 && (
                    <span className="text-[11px] text-[#555570] font-mono">
                      {cooldownDays}d &gt; {cooldownDays*2}d &gt; {Math.min(cooldownDays*4, 30)}d &gt; {Math.min(cooldownDays*8, 30)}d (cap 30d)
                    </span>
                  )}
                  {cooldownDays === 0 && (
                    <span className="text-[11px] text-[#ef4444] font-mono">Cooldown = 0 — M4 has no effect</span>
                  )}
                </MitigantToggle>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Row 3: Withdrawal + Advanced */}
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
          <span className="text-[13px] text-[#555570] font-semibold uppercase tracking-[0.12em] block">Gas</span>
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
          <span className="text-[13px] text-[#555570] font-semibold uppercase tracking-[0.12em] block">Slippage</span>
          <div className="flex items-center gap-4 bg-[#0a0a14] border border-[#1a1a2e] rounded-xl px-4 py-2">
            <input type="range" min="0" max="50" value={slippage * 10000}
              onChange={e => setSlippage(parseInt(e.target.value) / 10000)} className="w-28" />
            <span className="text-[12px] font-mono text-[#f0f0f8] tabular-nums min-w-[50px] text-right font-semibold">
              {(slippage * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Row 4: Rebalance Delay */}
      <div className="flex flex-wrap gap-8 items-end mt-8 pt-8 border-t border-[#1a1a2e]/50">
        <PillToggle label="Rebalance Delay" value={rebalanceDelay} onChange={setRebalanceDelay} compact
          options={[
            { value: 0, label: 'Instant' },
            { value: 1, label: '24h' },
            { value: 1.5, label: '36h' },
            { value: 2, label: '48h' },
            { value: 3, label: '72h' },
            { value: 4, label: '96h' },
          ]} />
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
              className="text-[13px] text-[#8888a8] hover:text-[#f7931a] transition-colors px-4 py-2 rounded-xl border border-[#1a1a2e] hover:border-[#f7931a]">
              Reset
            </button>
          </div>
          <div className="flex gap-6 text-[13px] text-[#555570] flex-wrap">
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
