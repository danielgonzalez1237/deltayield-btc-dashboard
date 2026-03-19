function Stat({ label, value, unit, color, glow }) {
  return (
    <div className={`bg-[#111119] border border-[#1f1f30] rounded-2xl px-5 py-4 min-w-[140px] flex-1 ${glow || ''}`}>
      <div className="text-[10px] text-[#4e4e66] font-semibold uppercase tracking-[0.08em] mb-2">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-semibold font-mono tabular-nums tracking-tight ${color || 'text-[#eaeaf2]'}`}>
          {value}
        </span>
        {unit && <span className="text-[10px] text-[#4e4e66] font-medium">{unit}</span>}
      </div>
    </div>
  );
}

export default function MetricsBar({ metrics, costs, benchmark, btcUsd }) {
  const { finalBtc, cagr, maxDD, cagrDdRatio, rebalanceCount, activeDays, years, maxHedgeExposure } = metrics;
  const netGain = costs.net;
  const isUsd = benchmark === 'usd';
  const mul = isUsd ? btcUsd : 1;
  const unit = isUsd ? 'USD' : 'BTC';
  const fmt = (v) => isUsd ? `$${(v * mul).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : v.toFixed(4);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-5 mb-7">
      <Stat label="Final Balance" value={fmt(finalBtc)} unit={isUsd ? '' : unit}
        color="text-[#f7931a]"
        glow="shadow-[inset_0_1px_0_rgba(247,147,26,0.08),0_0_20px_rgba(247,147,26,0.03)]" />
      <Stat label="Net Gain" value={netGain >= 0 ? `+${fmt(netGain)}` : fmt(netGain)} unit={isUsd ? '' : unit}
        color={netGain >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}
        glow={netGain >= 0 ? 'shadow-[inset_0_1px_0_rgba(52,211,153,0.08),0_0_20px_rgba(52,211,153,0.03)]' : ''} />
      <Stat label="CAGR" value={`${cagr.toFixed(2)}%`}
        color={cagr >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'} />
      <Stat label="Max Drawdown" value={`${maxDD.toFixed(2)}%`} color="text-[#f87171]" />
      <Stat label="CAGR/DD" value={cagrDdRatio === Infinity ? '∞' : cagrDdRatio.toFixed(1)} color="text-[#60a5fa]" />
      <Stat label="Rebalances" value={rebalanceCount} />
      <Stat label="Active Days" value={activeDays.toLocaleString()} />
      <Stat label="Max Hedge" value={maxHedgeExposure ? `${maxHedgeExposure.toFixed(4)}` : 'N/A'} unit={maxHedgeExposure ? 'BTC' : ''} color="text-[#c084fc]" />
    </div>
  );
}
