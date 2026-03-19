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
    <div className="bg-[#12121e] border border-[#252540] rounded-2xl px-5 py-4 text-xs shadow-2xl shadow-black/50">
      <div className="text-[#8888a8] mb-3 text-[10px] font-semibold uppercase tracking-wider">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-8 py-1">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-[#8888a8]">{p.name}</span>
          </span>
          <span className="font-mono text-[#f0f0f8] tabular-nums font-semibold">
            {isUsd ? `$${(typeof p.value === 'number' ? p.value : 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : (typeof p.value === 'number' ? p.value.toFixed(6) : p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function MainChart({ series, benchmark, withdrawal, withdrawalResult }) {
  const [timeRange, setTimeRange] = useState('3y');
  const isUsd = benchmark === 'usd';
  const hasWithdrawal = withdrawal && withdrawal !== 'none' && withdrawalResult;

  const chartData = useMemo(() => {
    const filtered = filterByTimeRange(series, timeRange);
    const step = Math.max(1, Math.floor(filtered.length / 500));

    // Build a date->withdrawalBtc map if we have withdrawal data
    const wMap = {};
    if (hasWithdrawal && withdrawalResult?.series) {
      withdrawalResult.series.forEach(w => { wMap[w.date] = w.btc; });
    }

    return filtered
      .filter((_, i) => i % step === 0 || i === filtered.length - 1)
      .map(s => {
        const row = {
          dateLabel: formatDateShort(s.date),
          btc: isUsd ? s.btc * s.btcUsd : s.btc,
          benchmark: isUsd ? 1.0 * s.btcUsd : 1.0,
        };
        if (hasWithdrawal && wMap[s.date] != null) {
          row.withdrawalBtc = isUsd ? wMap[s.date] * s.btcUsd : wMap[s.date];
        }
        return row;
      });
  }, [series, timeRange, isUsd, hasWithdrawal, withdrawalResult]);

  const allVals = chartData.flatMap(d => [d.btc, d.benchmark, ...(d.withdrawalBtc != null ? [d.withdrawalBtc] : [])]);
  const yMin = Math.min(...allVals) * 0.995;
  const yMax = Math.max(...allVals) * 1.005;

  return (
    <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-3xl p-8 h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-bold text-[#f0f0f8]">
            {isUsd ? 'Portfolio Value (USD)' : 'BTC Balance'}
          </h2>
          <p className="text-[11px] text-[#555570] mt-1">
            {isUsd ? 'vs $1 BTC HODL in USD' : 'vs 1 BTC HODL benchmark'}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-5 text-[11px] mr-4">
            <span className="flex items-center gap-2">
              <span className="w-4 h-0.5 bg-[#f7931a] rounded" />
              <span className="text-[#8888a8]">Strategy</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 h-0.5 bg-[#8888a8] rounded opacity-40" />
              <span className="text-[#8888a8]">HODL</span>
            </span>
            {hasWithdrawal && (
              <span className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-[#a855f7] rounded" />
                <span className="text-[#8888a8]">With Withdrawals</span>
              </span>
            )}
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: isUsd ? 10 : -5, bottom: 0 }}>
          <defs>
            <linearGradient id="btcGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f7931a" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#f7931a" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#555570' }} axisLine={{ stroke: '#1a1a2e' }} tickLine={false} interval={Math.floor(chartData.length / 7)} />
          <YAxis domain={[yMin, yMax]} tick={{ fontSize: 10, fill: '#555570' }} axisLine={false} tickLine={false}
            tickFormatter={v => isUsd ? `$${(v / 1000).toFixed(0)}k` : v.toFixed(2)} />
          <Tooltip content={<ChartTooltip benchmark={benchmark} />} />
          <Area type="monotone" dataKey="btc" name="Strategy" stroke="#f7931a" fill="url(#btcGradient)" strokeWidth={2.5} dot={false} animationDuration={400} />
          <Line type="monotone" dataKey="benchmark" name="HODL" stroke="#8888a8" strokeWidth={1} strokeDasharray="6 4" strokeOpacity={0.3} dot={false} />
          {hasWithdrawal && <Line type="monotone" dataKey="withdrawalBtc" name="With Withdrawals" stroke="#a855f7" strokeWidth={2} dot={false} strokeDasharray="4 3" />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
