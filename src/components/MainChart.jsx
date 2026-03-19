import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { useMemo, useState } from 'react';
import { filterByTimeRange, formatDateShort } from '../engine';
import TimeRangeSelector from './TimeRangeSelector';

function ChartTooltip({ active, payload, label, benchmark }) {
  if (!active || !payload?.length) return null;
  const isUsd = benchmark === 'usd';
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
            {isUsd ? `$${(typeof p.value === 'number' ? p.value : 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : (typeof p.value === 'number' ? p.value.toFixed(6) : p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function MainChart({ series, benchmark }) {
  const [timeRange, setTimeRange] = useState('3y');
  const isUsd = benchmark === 'usd';

  const chartData = useMemo(() => {
    const filtered = filterByTimeRange(series, timeRange);
    const step = Math.max(1, Math.floor(filtered.length / 500));
    return filtered
      .filter((_, i) => i % step === 0 || i === filtered.length - 1)
      .map(s => ({
        dateLabel: formatDateShort(s.date),
        btc: isUsd ? s.btc * s.btcUsd : s.btc,
        benchmark: isUsd ? 1.0 * s.btcUsd : 1.0,
      }));
  }, [series, timeRange, isUsd]);

  const yMin = Math.min(...chartData.map(d => Math.min(d.btc, d.benchmark))) * 0.995;
  const yMax = Math.max(...chartData.map(d => Math.max(d.btc, d.benchmark))) * 1.005;

  return (
    <div className="bg-[#111119] border border-[#1f1f30] rounded-2xl p-6 h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-[#eaeaf2]">
            {isUsd ? 'Portfolio Value (USD)' : 'BTC Balance'}
          </h2>
          <p className="text-[10px] text-[#4e4e66] mt-0.5">
            {isUsd ? 'vs $1 BTC HODL in USD' : 'vs 1 BTC HODL benchmark'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-[10px] mr-3">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#f7931a] rounded" />
              <span className="text-[#7a7a96]">Strategy</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#7a7a96] rounded opacity-50" />
              <span className="text-[#7a7a96]">HODL</span>
            </span>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: isUsd ? 10 : -5, bottom: 0 }}>
          <defs>
            <linearGradient id="btcGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f7931a" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#f7931a" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#4e4e66' }} axisLine={{ stroke: '#1f1f30' }} tickLine={false} interval={Math.floor(chartData.length / 7)} />
          <YAxis domain={[yMin, yMax]} tick={{ fontSize: 10, fill: '#4e4e66' }} axisLine={false} tickLine={false}
            tickFormatter={v => isUsd ? `$${(v / 1000).toFixed(0)}k` : v.toFixed(2)} />
          <Tooltip content={<ChartTooltip benchmark={benchmark} />} />
          <Area type="monotone" dataKey="btc" name="Strategy" stroke="#f7931a" fill="url(#btcGradient)" strokeWidth={2} dot={false} animationDuration={400} />
          <Line type="monotone" dataKey="benchmark" name="HODL" stroke="#7a7a96" strokeWidth={1} strokeDasharray="6 4" strokeOpacity={0.4} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
