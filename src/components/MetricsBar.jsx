function Stat({ label, value, unit, color, glow }) {
  return (
    <div className={`bg-[#111119] border border-[#1f1f30] rounded-xl px-4 py-3 min-w-[130px] flex-1 ${glow || ''}`}>
      <div className="text-[10px] text-[#4e4e66] font-semibold uppercase tracking-[0.08em] mb-1.5">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-semibold font-mono tabular-nums tracking-tight ${color || 'text-[#eaeaf2]'}`}>
          {value}
        </span>
        {unit && <span className="text-[10px] text-[#4e4e66] font-medium">{unit}</span>}
      </div>
    </div>
  );
}

export default function MetricsBar({ metrics, costs }) {
  const { finalBtc, cagr, maxDD, cagrDdRatio, rebalanceCount, activeDays, years } = metrics;
  const netGain = costs.net;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3 mb-5">
      <Stat
        label="Final Balance"
        value={finalBtc.toFixed(4)}
        unit="BTC"
        color="text-[#f7931a]"
        glow="shadow-[inset_0_1px_0_rgba(247,147,26,0.08),0_0_20px_rgba(247,147,26,0.03)]"
      />
      <Stat
        label="Net Gain"
        value={netGain >= 0 ? `+${netGain.toFixed(4)}` : netGain.toFixed(4)}
        unit="BTC"
        color={netGain >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}
        glow={netGain >= 0
          ? 'shadow-[inset_0_1px_0_rgba(52,211,153,0.08),0_0_20px_rgba(52,211,153,0.03)]'
          : 'shadow-[inset_0_1px_0_rgba(248,113,113,0.08)]'
        }
      />
      <Stat
        label="CAGR"
        value={`${cagr.toFixed(2)}%`}
        color={cagr >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}
      />
      <Stat
        label="Max Drawdown"
        value={`${maxDD.toFixed(2)}%`}
        color="text-[#f87171]"
      />
      <Stat
        label="CAGR/DD"
        value={cagrDdRatio.toFixed(1)}
        color="text-[#60a5fa]"
      />
      <Stat label="Rebalances" value={rebalanceCount} />
      <Stat label="Active Days" value={activeDays.toLocaleString()} />
      <Stat label="Period" value={`${years.toFixed(1)}y`} />
    </div>
  );
}
