import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import { useMemo, useState } from 'react';
import { filterByTimeRange, formatDateShort } from '../engine';
import TimeRangeSelector from './TimeRangeSelector';

function ChartTooltip({ active, payload, label, isUsd }) {
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
          <span className="font-mono text-[#f0f0f8] tabular-nums font-semibold">
            {isUsd ? `$${(p.value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : (p.value || 0).toFixed(4)}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-2xl px-6 py-5 flex-1 min-w-[150px]">
      <div className="text-[13px] text-[#555570] uppercase tracking-wider mb-2 font-semibold">{label}</div>
      <div className={`text-xl font-mono font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[13px] text-[#555570] mt-1">{sub}</div>}
    </div>
  );
}

export default function HybridChart({ hybridResult, arbOnlyResult, ethOnlyResult, benchmark }) {
  const [timeRange, setTimeRange] = useState('3y');
  const isUsd = benchmark === 'usd';

  const chartData = useMemo(() => {
    const filtered = filterByTimeRange(hybridResult.series, timeRange);
    const step = Math.max(1, Math.floor(filtered.length / 400));
    return filtered
      .filter((_, i) => i % step === 0 || i === filtered.length - 1)
      .map((s, idx) => {
        const origIdx = hybridResult.series.indexOf(s);
        const mul = isUsd ? s.btcUsd : 1;
        const entry = {
          dateLabel: formatDateShort(s.date),
          hybrid: s.btc * mul,
          arbPool: s.arbBtc * mul,
          ethPool: s.ethBtc * mul,
        };
        if (origIdx < arbOnlyResult.series.length)
          entry.arbOnly = arbOnlyResult.series[origIdx].btc * mul;
        if (origIdx < ethOnlyResult.series.length)
          entry.ethOnly = ethOnlyResult.series[origIdx].btc * mul;
        return entry;
      });
  }, [hybridResult, arbOnlyResult, ethOnlyResult, timeRange, isUsd]);

  const m = hybridResult.metrics;
  const mul = isUsd ? (hybridResult.series[hybridResult.series.length - 1]?.btcUsd || 85000) : 1;
  const fmt = (v) => isUsd ? `$${(v * mul).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : v.toFixed(4);

  return (
    <div className="space-y-8">
      <div className="flex gap-4 flex-wrap">
        <StatCard label="Hybrid Total" value={fmt(m.finalBtc)} color="text-[#f7931a]" sub={`CAGR: ${m.cagr.toFixed(2)}%`} />
        <StatCard label="ARB Pool (50%)" value={fmt(m.arbFinalBtc)} color="text-[#3b82f6]" sub={`Gas: ${m.arbGas.toFixed(6)} BTC`} />
        <StatCard label="ETH Pool (50%)" value={fmt(m.ethFinalBtc)} color="text-[#a855f7]" sub={`Gas: ${m.ethGas.toFixed(6)} BTC`} />
        <StatCard label="Shared Hedge" value={`+${hybridResult.hedgePnl.toFixed(4)}`} color="text-[#22c55e]" sub={`Perp fees: -${hybridResult.hedgePerpFees.toFixed(4)}`} />
        <StatCard label="100% ARB" value={fmt(arbOnlyResult.metrics.finalBtc)} color="text-[#555570]" sub={`CAGR: ${arbOnlyResult.metrics.cagr.toFixed(2)}%`} />
        <StatCard label="100% ETH" value={fmt(ethOnlyResult.metrics.finalBtc)} color="text-[#555570]" sub={`CAGR: ${ethOnlyResult.metrics.cagr.toFixed(2)}%`} />
      </div>

      <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-3xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-[#f0f0f8]">Hybrid 50/50 Strategy</h2>
            <p className="text-[13px] text-[#555570] mt-1">ARB 0.05% + ETH 0.30% with shared hedge vs single-pool strategies</p>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <ResponsiveContainer width="100%" height={450}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: isUsd ? 10 : -5, bottom: 0 }}>
            <defs>
              <linearGradient id="hybridGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f7931a" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#f7931a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 12, fill: '#555570' }} axisLine={{ stroke: '#1a1a2e' }} tickLine={false} interval={Math.floor(chartData.length / 7)} />
            <YAxis tick={{ fontSize: 12, fill: '#555570' }} axisLine={false} tickLine={false}
              tickFormatter={v => isUsd ? `$${(v / 1000).toFixed(0)}k` : v.toFixed(2)} />
            <Tooltip content={<ChartTooltip isUsd={isUsd} />} />
            <Area type="monotone" dataKey="hybrid" name="Hybrid 50/50" stroke="#f7931a" fill="url(#hybridGrad)" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="arbOnly" name="100% ARB" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 3" dot={false} strokeOpacity={0.8} />
            <Line type="monotone" dataKey="ethOnly" name="100% ETH" stroke="#a855f7" strokeWidth={2} strokeDasharray="4 3" dot={false} strokeOpacity={0.8} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
