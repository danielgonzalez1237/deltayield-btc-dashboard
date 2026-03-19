import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import { useMemo, useState } from 'react';
import { filterByTimeRange, formatDateShort } from '../engine';
import TimeRangeSelector from './TimeRangeSelector';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#16161f] border border-[#2a2a40] rounded-xl px-4 py-3 text-xs shadow-2xl shadow-black/40">
      <div className="text-[#4e4e66] mb-2 text-[10px] font-semibold uppercase tracking-wider">{label}</div>
      {payload.filter(p => p.value != null).map((p, i) => (
        <div key={i} className="flex justify-between gap-6 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-[#7a7a96]">{p.name}</span>
          </span>
          <span className="font-mono text-[#eaeaf2] tabular-nums">{p.value?.toFixed(4)}</span>
        </div>
      ))}
    </div>
  );
}

export default function PriceRangeChart({ series }) {
  const [timeRange, setTimeRange] = useState('3y');

  const chartData = useMemo(() => {
    const filtered = filterByTimeRange(series, timeRange).filter(s => s.btceth != null);
    const step = Math.max(1, Math.floor(filtered.length / 500));
    return filtered
      .filter((_, i) => i % step === 0 || i === filtered.length - 1)
      .map(s => ({
        dateLabel: formatDateShort(s.date),
        price: s.btceth,
        upper: s.rangeCenter ? parseFloat((1 / (s.rangeCenter * (1 - RANGE_WIDTH))).toFixed(4)) : null,
        lower: s.rangeCenter ? parseFloat((1 / (s.rangeCenter * (1 + RANGE_WIDTH))).toFixed(4)) : null,
        center: s.rangeCenter ? parseFloat((1 / s.rangeCenter).toFixed(4)) : null,
      }));
  }, [series, timeRange]);

  const inRange = series.filter(s => s.on && s.ethbtc && s.rangeLower && s.rangeUpper &&
    s.ethbtc >= s.rangeLower && s.ethbtc <= s.rangeUpper).length;
  const totalOn = series.filter(s => s.on && s.ethbtc).length;
  const inRangePct = totalOn > 0 ? (inRange / totalOn * 100).toFixed(1) : 0;

  return (
    <div className="bg-[#111119] border border-[#1f1f30] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-[#eaeaf2]">BTC/ETH Price & Range Bounds</h2>
          <p className="text-[10px] text-[#4e4e66] mt-0.5">Concentrated liquidity range with rebalance triggers</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-[rgba(52,211,153,0.08)] border border-[rgba(52,211,153,0.15)] rounded-lg px-3 py-1.5">
            <span className="text-[10px] text-[#7a7a96] mr-1.5">In Range</span>
            <span className="text-sm font-mono font-semibold text-[#34d399] tabular-nums">{inRangePct}%</span>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
          <defs>
            <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.06} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#4e4e66' }} axisLine={{ stroke: '#1f1f30' }} tickLine={false} interval={Math.floor(chartData.length / 7)} />
          <YAxis tick={{ fontSize: 10, fill: '#4e4e66' }} tickFormatter={v => v.toFixed(1)} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="stepAfter" dataKey="upper" name="Upper Bound" stroke="none" fill="url(#rangeGradient)" dot={false} />
          <Line type="stepAfter" dataKey="center" name="Range Center" stroke="#34d399" strokeWidth={1} strokeDasharray="4 4" strokeOpacity={0.5} dot={false} />
          <Line type="stepAfter" dataKey="upper" name="Upper" stroke="#34d399" strokeWidth={1} strokeOpacity={0.25} dot={false} />
          <Line type="stepAfter" dataKey="lower" name="Lower" stroke="#34d399" strokeWidth={1} strokeOpacity={0.25} dot={false} />
          <Line type="monotone" dataKey="price" name="BTC/ETH" stroke="#f7931a" strokeWidth={1.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const RANGE_WIDTH = 0.10;
