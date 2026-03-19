import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
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
          <span className="font-mono text-[#eaeaf2] tabular-nums">{p.value?.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div className="bg-[#111119] border border-[#1f1f30] rounded-2xl px-5 py-4 flex-1 min-w-[130px]">
      <div className="text-[10px] text-[#4e4e66] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-mono font-semibold tabular-nums ${color}`}>{value}</div>
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
    <div className="space-y-6">
      <div className="flex gap-4 flex-wrap">
        <StatPill label="Avg Funding" value={`${fAvg.toFixed(2)}%`} color="text-[#c084fc]" />
        <StatPill label="Min Funding" value={`${fMin.toFixed(2)}%`} color="text-[#f87171]" />
        <StatPill label="Max Funding" value={`${fMax.toFixed(2)}%`} color="text-[#34d399]" />
        <StatPill label="Positive Days" value={`${fPos}%`} color="text-[#34d399]" />
        <StatPill label="Avg Pool APY" value={`${aAvg.toFixed(2)}%`} color="text-[#60a5fa]" />
        <StatPill label="Min APY" value={`${aMin.toFixed(2)}%`} color="text-[#f87171]" />
        <StatPill label="Max APY" value={`${aMax.toFixed(2)}%`} color="text-[#34d399]" />
      </div>

      {/* Funding Rate */}
      <div className="bg-[#111119] border border-[#1f1f30] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#eaeaf2]">Funding Rate</h2>
            <p className="text-[10px] text-[#4e4e66] mt-0.5">Annualized % — Weekly avg (Binance pre-2023, Hyperliquid post-2023)</p>
          </div>
          <TimeRangeSelector value={fundingRange} onChange={setFundingRange} />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={fundingData} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#4e4e66' }} axisLine={{ stroke: '#1f1f30' }} tickLine={false} interval={Math.floor(fundingData.length / 7)} />
            <YAxis tick={{ fontSize: 10, fill: '#4e4e66' }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke="#7a7a96" strokeOpacity={0.2} />
            <Bar dataKey="funding" name="Funding Rate" fill="#c084fc" fillOpacity={0.5} radius={[2, 2, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Pool APY */}
      <div className="bg-[#111119] border border-[#1f1f30] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#eaeaf2]">Pool APY</h2>
            <p className="text-[10px] text-[#4e4e66] mt-0.5">Weekly average — adjusted by 0.94x multiplier in backtest</p>
          </div>
          <TimeRangeSelector value={apyRange} onChange={setApyRange} />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={apyData} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
            <defs>
              <linearGradient id="apyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#4e4e66' }} axisLine={{ stroke: '#1f1f30' }} tickLine={false} interval={Math.floor(apyData.length / 7)} />
            <YAxis tick={{ fontSize: 10, fill: '#4e4e66' }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="apy" name="Pool APY" stroke="#60a5fa" strokeWidth={1.5} dot={false} fill="url(#apyGrad)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
