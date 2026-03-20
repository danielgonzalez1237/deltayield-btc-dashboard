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
    <div className="bg-[#12121e] border border-[#252540] rounded-2xl px-5 py-4 text-xs shadow-2xl shadow-black/50">
      <div className="text-[#555570] mb-3 text-[13px] font-semibold uppercase tracking-wider">{label}</div>
      {payload.filter(p => p.value != null).map((p, i) => (
        <div key={i} className="flex justify-between gap-8 py-1">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-[#8888a8]">{p.name}</span>
          </span>
          <span className="font-mono text-[#f0f0f8] tabular-nums font-semibold">{p.value?.toFixed(4)}</span>
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
    <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-3xl p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-bold text-[#f0f0f8]">BTC/ETH Price & Range Bounds</h2>
          <p className="text-[13px] text-[#555570] mt-1">Concentrated liquidity range with rebalance triggers</p>
        </div>
        <div className="flex items-center gap-5">
          <div className="bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.12)] rounded-xl px-4 py-2">
            <span className="text-[13px] text-[#8888a8] mr-2">In Range</span>
            <span className="text-sm font-mono font-bold text-[#22c55e] tabular-nums">{inRangePct}%</span>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={450}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
          <defs>
            <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 12, fill: '#555570' }} axisLine={{ stroke: '#1a1a2e' }} tickLine={false} interval={Math.floor(chartData.length / 7)} />
          <YAxis tick={{ fontSize: 12, fill: '#555570' }} tickFormatter={v => v.toFixed(1)} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="stepAfter" dataKey="upper" name="Upper Bound" stroke="none" fill="url(#rangeGradient)" dot={false} />
          <Line type="stepAfter" dataKey="center" name="Range Center" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.5} dot={false} />
          <Line type="stepAfter" dataKey="upper" name="Upper" stroke="#22c55e" strokeWidth={1.5} strokeOpacity={0.25} dot={false} />
          <Line type="stepAfter" dataKey="lower" name="Lower" stroke="#22c55e" strokeWidth={1.5} strokeOpacity={0.25} dot={false} />
          <Line type="monotone" dataKey="price" name="BTC/ETH" stroke="#f7931a" strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const RANGE_WIDTH = 0.10;
