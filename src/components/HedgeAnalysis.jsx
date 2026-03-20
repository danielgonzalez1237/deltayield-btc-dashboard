import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceDot,
} from 'recharts';
import { useMemo, useState } from 'react';
import { filterByTimeRange, formatDateShort, formatDate } from '../engine';
import TimeRangeSelector from './TimeRangeSelector';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#12121e] border border-[#252540] rounded-2xl px-5 py-4 text-xs shadow-2xl shadow-black/50">
      <div className="text-[#555570] mb-3 text-[10px] font-semibold uppercase tracking-wider">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-8 py-1">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-[#8888a8]">{p.name}</span>
          </span>
          <span className="font-mono text-[#f0f0f8] tabular-nums font-semibold">
            {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-2xl px-6 py-5">
      <div className="text-[11px] text-[#555570] uppercase tracking-wider mb-2 font-semibold">{label}</div>
      <div className={`text-xl font-mono font-bold tabular-nums ${color || 'text-[#f0f0f8]'}`}>{value}</div>
      {sub && <div className="text-[11px] text-[#555570] mt-1">{sub}</div>}
    </div>
  );
}

export default function HedgeAnalysis({ series, metrics, costs, benchmark }) {
  const [timeRange, setTimeRange] = useState('all');
  const isUsd = benchmark === 'usd';

  const marginStops = metrics?.marginStops || 0;
  const avgStopLoss = metrics?.avgStopLoss || 0;
  const cooldownPct = metrics?.cooldownPct || 0;
  const cooldownTotalDays = metrics?.cooldownDays || 0;

  // Filter margin stop events from series
  const stopEvents = useMemo(() => {
    return (series || []).filter(s => s.marginStop);
  }, [series]);

  // Build hedge P&L chart data
  const chartData = useMemo(() => {
    if (!series?.length) return [];
    const filtered = filterByTimeRange(series, timeRange);
    const step = Math.max(1, Math.floor(filtered.length / 500));
    return filtered
      .filter((_, i) => i % step === 0 || i === filtered.length - 1)
      .map(s => ({
        dateLabel: formatDateShort(s.date),
        hedgePnl: s.hedge || 0,
        fundingIncome: s.fees || 0,
        totalAum: s.btc || 0,
        shortPnl: s.shortPnlBtc || 0,
        ethUsd: s.ethUsd || 0,
      }));
  }, [series, timeRange]);

  // Margin utilization over time
  const utilizationData = useMemo(() => {
    if (!series?.length) return [];
    const filtered = filterByTimeRange(series, timeRange);
    const step = Math.max(1, Math.floor(filtered.length / 400));
    return filtered
      .filter((_, i) => i % step === 0 || i === filtered.length - 1)
      .map(s => ({
        dateLabel: formatDateShort(s.date),
        aum: s.btc || 0,
        lpBtc: s.lpBtc || 0,
        scBtc: s.scBtc || 0,
        inCooldown: s.inCooldown ? 1 : 0,
      }));
  }, [series, timeRange]);

  return (
    <div className="space-y-8">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Margin Stops" value={marginStops} sub={`~${(marginStops / (metrics?.totalDays || 1) * 365).toFixed(1)}/year`} color="text-[#ef4444]" />
        <StatCard label="Avg Stop Loss" value={`${avgStopLoss.toFixed(4)} BTC`} color="text-[#ef4444]" />
        <StatCard label="Time in Cooldown" value={`${cooldownPct.toFixed(1)}%`} sub={`${cooldownTotalDays} days total`} color="text-[#f7931a]" />
        <StatCard label="Hedge Net P&L"
          value={`${(costs?.hedge || 0) >= 0 ? '+' : ''}${(costs?.hedge || 0).toFixed(4)} BTC`}
          sub={`Funding: +${(costs?.fundingIncome || costs?.hedge || 0).toFixed(4)}`}
          color={(costs?.hedge || 0) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'} />
      </div>

      {/* Cumulative Hedge P&L Chart */}
      <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-3xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-[#f0f0f8]">Hedge P&L Over Time</h2>
            <p className="text-[11px] text-[#555570] mt-1">Cumulative funding income + short P&L in BTC</p>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
            <defs>
              <linearGradient id="hedgeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#555570' }} axisLine={{ stroke: '#1a1a2e' }} tickLine={false} interval={Math.floor(chartData.length / 7)} />
            <YAxis tick={{ fontSize: 10, fill: '#555570' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(2)} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="hedgePnl" name="Hedge P&L" stroke="#22c55e" fill="url(#hedgeGrad)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="shortPnl" name="Short P&L" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Capital Allocation Chart */}
      <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-3xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-[#f0f0f8]">Capital Allocation</h2>
            <p className="text-[11px] text-[#555570] mt-1">LP (pool) vs Short Collateral breakdown</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={utilizationData} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#555570' }} axisLine={{ stroke: '#1a1a2e' }} tickLine={false} interval={Math.floor(utilizationData.length / 7)} />
            <YAxis tick={{ fontSize: 10, fill: '#555570' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(2)} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="lpBtc" name="LP (Pool)" stroke="#f7931a" fill="rgba(247,147,26,0.08)" strokeWidth={2} dot={false} stackId="1" />
            <Area type="monotone" dataKey="scBtc" name="Short Collateral" stroke="#3b82f6" fill="rgba(59,130,246,0.08)" strokeWidth={2} dot={false} stackId="1" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Margin Stop Events Table */}
      {stopEvents.length > 0 && (
        <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-3xl p-8">
          <h3 className="text-sm font-bold text-[#f0f0f8] mb-1">Margin Stop Events</h3>
          <p className="text-[11px] text-[#555570] mb-5">
            {stopEvents.length} forced closures — each triggers cooldown before reopening
          </p>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-[#0d0d17]">
                <tr className="border-b border-[#1a1a2e]">
                  <th className="text-left py-3 px-3 text-[#555570] font-semibold uppercase tracking-wider text-[10px]">#</th>
                  <th className="text-left py-3 px-3 text-[#555570] font-semibold uppercase tracking-wider text-[10px]">Date</th>
                  <th className="text-right py-3 px-3 text-[#555570] font-semibold uppercase tracking-wider text-[10px]">ETH/USD</th>
                  <th className="text-right py-3 px-3 text-[#555570] font-semibold uppercase tracking-wider text-[10px]">BTC Balance</th>
                </tr>
              </thead>
              <tbody>
                {stopEvents.map((s, i) => (
                  <tr key={i} className="border-b border-[#1a1a2e]/30 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="py-2.5 px-3 text-[#555570]">{i + 1}</td>
                    <td className="py-2.5 px-3 text-[#8888a8] font-mono tabular-nums">{formatDate(s.date)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#8888a8]">
                      ${(s.ethUsd || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#ef4444] font-semibold">
                      {(s.btc || 0).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
