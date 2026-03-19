import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { useMemo } from 'react';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#16161f] border border-[#2a2a40] rounded-xl px-4 py-3 text-xs shadow-2xl shadow-black/40">
      <div className="text-[#7a7a96] mb-2 text-[10px] font-semibold uppercase tracking-wider">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-6 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-[#7a7a96]">{p.name}</span>
          </span>
          <span className="font-mono text-[#eaeaf2] tabular-nums">
            {typeof p.value === 'number' ? p.value.toFixed(6) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function MainChart({ series, benchmark }) {
  const chartData = useMemo(() => {
    return series
      .filter((_, i) => i % 3 === 0 || i === series.length - 1)
      .map(s => ({
        dateLabel: s.date.slice(2, 10),
        btc: s.btc,
        benchmark: 1.0,
      }));
  }, [series]);

  const yMin = Math.min(1.0, ...chartData.map(d => d.btc)) * 0.995;
  const yMax = Math.max(1.0, ...chartData.map(d => d.btc)) * 1.005;

  return (
    <div className="bg-[#111119] border border-[#1f1f30] rounded-2xl p-5 h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-[#eaeaf2]">BTC Balance</h2>
          <p className="text-[10px] text-[#4e4e66] mt-0.5">
            {benchmark === 'btc' ? 'vs 1 BTC HODL benchmark' : 'USD value over time'}
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#f7931a] rounded" />
            <span className="text-[#7a7a96]">Strategy</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#7a7a96] rounded opacity-50" style={{ borderTop: '1px dashed' }} />
            <span className="text-[#7a7a96]">HODL</span>
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
          <defs>
            <linearGradient id="btcGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f7931a" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#f7931a" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: '#4e4e66' }}
            axisLine={{ stroke: '#1f1f30' }}
            tickLine={false}
            interval={Math.floor(chartData.length / 7)}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: '#4e4e66' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => v.toFixed(2)}
          />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine y={1.0} stroke="#7a7a96" strokeDasharray="6 4" strokeOpacity={0.3} />
          <Area
            type="monotone"
            dataKey="btc"
            name="Strategy"
            stroke="#f7931a"
            fill="url(#btcGradient)"
            strokeWidth={2}
            dot={false}
            animationDuration={400}
          />
          <Line
            type="monotone"
            dataKey="benchmark"
            name="HODL 1 BTC"
            stroke="#7a7a96"
            strokeWidth={1}
            strokeDasharray="6 4"
            strokeOpacity={0.4}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
