import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
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
          <span className="font-mono text-[#f0f0f8] tabular-nums font-semibold">{p.value?.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-2xl px-6 py-5 flex-1 min-w-[140px]">
      <div className="text-[13px] text-[#555570] uppercase tracking-wider font-semibold mb-2">{label}</div>
      <div className={`text-xl font-mono font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

export default function FundingChart({ series }) {
  const [fundingRange, setFundingRange] = useState('3y');
  const [apyRange, setApyRange] = useState('3y');

  const fundingFiltered = useMemo(() => filterByTimeRange(series, fundingRange), [series, fundingRange]);
  const apyFiltered = useMemo(() => filterByTimeRange(series, apyRange), [series, apyRange]);

  const buildWeekly = (data) => {
    const weekly = [];
    for (let i = 0; i < data.length; i += 7) {
      const week = data.slice(i, i + 7);
      const vf = week.filter(s => s.funding != null);
      const va = week.filter(s => s.apy != null);
      if (!vf.length && !va.length) continue;
      weekly.push({
        dateLabel: formatDateShort(week[0].date),
        funding: vf.length ? vf.reduce((a, s) => a + s.funding, 0) / vf.length : null,
        apy: va.length ? va.reduce((a, s) => a + s.apy, 0) / va.length : null,
      });
    }
    return weekly;
  };

  const fundingData = useMemo(() => buildWeekly(fundingFiltered), [fundingFiltered]);
  const apyData = useMemo(() => buildWeekly(apyFiltered), [apyFiltered]);

  const fAll = fundingFiltered.filter(s => s.funding != null).map(s => s.funding);
  const fAvg = fAll.length ? fAll.reduce((a, b) => a + b, 0) / fAll.length : 0;
  const fMin = fAll.length ? Math.min(...fAll) : 0;
  const fMax = fAll.length ? Math.max(...fAll) : 0;
  const fPos = fAll.length ? (fAll.filter(f => f > 0).length / fAll.length * 100).toFixed(1) : 0;

  const aAll = apyFiltered.filter(s => s.apy != null).map(s => s.apy);
  const aAvg = aAll.length ? aAll.reduce((a, b) => a + b, 0) / aAll.length : 0;
  const aMin = aAll.length ? Math.min(...aAll) : 0;
  const aMax = aAll.length ? Math.max(...aAll) : 0;

  return (
    <div className="space-y-8">
      <div className="flex gap-4 flex-wrap">
        <StatPill label="Avg Funding" value={`${fAvg.toFixed(2)}%`} color="text-[#a855f7]" />
        <StatPill label="Min Funding" value={`${fMin.toFixed(2)}%`} color="text-[#ef4444]" />
        <StatPill label="Max Funding" value={`${fMax.toFixed(2)}%`} color="text-[#22c55e]" />
        <StatPill label="Positive Days" value={`${fPos}%`} color="text-[#22c55e]" />
        <StatPill label="Avg Pool APY" value={`${aAvg.toFixed(2)}%`} color="text-[#3b82f6]" />
        <StatPill label="Min APY" value={`${aMin.toFixed(2)}%`} color="text-[#ef4444]" />
        <StatPill label="Max APY" value={`${aMax.toFixed(2)}%`} color="text-[#22c55e]" />
      </div>

      {/* Funding Rate */}
      <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-3xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-[#f0f0f8]">Funding Rate</h2>
            <p className="text-[13px] text-[#555570] mt-1">Annualized % — Weekly avg (Binance pre-2023, Hyperliquid post-2023)</p>
          </div>
          <TimeRangeSelector value={fundingRange} onChange={setFundingRange} />
        </div>
        <ResponsiveContainer width="100%" height={450}>
          <ComposedChart data={fundingData} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 12, fill: '#555570' }} axisLine={{ stroke: '#1a1a2e' }} tickLine={false} interval={Math.floor(fundingData.length / 7)} />
            <YAxis tick={{ fontSize: 12, fill: '#555570' }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke="#8888a8" strokeOpacity={0.15} />
            <Area type="monotone" dataKey="funding" name="Funding Rate" stroke="#a855f7" fill="rgba(168,85,247,0.25)" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Pool APY */}
      <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-3xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-[#f0f0f8]">Pool APY</h2>
            <p className="text-[13px] text-[#555570] mt-1">Weekly average — adjusted by 0.94x multiplier in backtest</p>
          </div>
          <TimeRangeSelector value={apyRange} onChange={setApyRange} />
        </div>
        <ResponsiveContainer width="100%" height={450}>
          <ComposedChart data={apyData} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
            <defs>
              <linearGradient id="apyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 12, fill: '#555570' }} axisLine={{ stroke: '#1a1a2e' }} tickLine={false} interval={Math.floor(apyData.length / 7)} />
            <YAxis tick={{ fontSize: 12, fill: '#555570' }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="apy" name="Pool APY" stroke="#3b82f6" strokeWidth={2.5} dot={false} fill="url(#apyGrad)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
