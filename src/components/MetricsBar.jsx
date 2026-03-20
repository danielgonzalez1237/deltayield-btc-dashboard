function Stat({ label, value, unit, color, highlight }) {
  return (
    <div className={`bg-[#0d0d17] border rounded-2xl px-6 py-5 min-w-[150px] flex-1 transition-all ${
      highlight ? 'border-[#f7931a]/20 shadow-[0_0_24px_rgba(247,147,26,0.04)]' : 'border-[#1a1a2e]'
    }`}>
      <div className="text-[13px] text-[#555570] font-semibold uppercase tracking-[0.1em] mb-2.5">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${color || 'text-[#f0f0f8]'}`}>
          {value}
        </span>
        {unit && <span className="text-[13px] text-[#555570] font-medium">{unit}</span>}
      </div>
    </div>
  );
}

export default function MetricsBar({ metrics, costs, benchmark, btcUsd }) {
  const { finalBtc, cagr, maxDD, cagrDdRatio, rebalanceCount, activeDays, years, maxHedgeExposure,
    marginStops, cooldownPct } = metrics;
  const netGain = metrics.netGain != null ? metrics.netGain : (metrics.finalBtc - 1.0);
  const isUsd = benchmark === 'usd';
  const mul = isUsd ? btcUsd : 1;
  const unit = isUsd ? 'USD' : 'BTC';
  const fmt = (v) => isUsd ? `$${(v * mul).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : v.toFixed(4);

  const hasMarginStops = marginStops != null && marginStops > 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4 mb-10">
      <Stat label="Final Balance" value={fmt(finalBtc)} unit={isUsd ? '' : unit}
        color="text-[#f7931a]" highlight={true} />
      <Stat label="Net Gain" value={netGain >= 0 ? `+${fmt(netGain)}` : fmt(netGain)} unit={isUsd ? '' : unit}
        color={netGain >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'} />
      <Stat label="CAGR" value={`${cagr.toFixed(2)}%`}
        color={cagr >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'} />
      <Stat label="Max Drawdown" value={`${maxDD.toFixed(2)}%`} color="text-[#ef4444]" />
      <Stat label="CAGR/DD" value={cagrDdRatio === Infinity ? '∞' : cagrDdRatio.toFixed(2)} color="text-[#3b82f6]" />
      <Stat label="Rebalances" value={rebalanceCount} />
      {hasMarginStops ? (
        <Stat label="Margin Stops" value={marginStops} color="text-[#ef4444]" />
      ) : (
        <Stat label="Active Days" value={activeDays.toLocaleString()} />
      )}
      {hasMarginStops ? (
        <Stat label="In Cooldown" value={`${(cooldownPct || 0).toFixed(1)}%`} color="text-[#f7931a]" />
      ) : (
        <Stat label="Max Hedge" value={maxHedgeExposure ? `${maxHedgeExposure.toFixed(4)}` : 'N/A'} unit={maxHedgeExposure ? 'BTC' : ''} color="text-[#a855f7]" />
      )}
    </div>
  );
}
