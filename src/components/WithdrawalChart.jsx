import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import { useMemo, useState } from 'react';
import { simulateWithdrawals, filterByTimeRange, formatDateShort } from '../engine';
import TimeRangeSelector from './TimeRangeSelector';

function ChartTooltip({ active, payload, label, isUsd }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#12121e] border border-[#252540] rounded-2xl px-5 py-4 text-xs shadow-2xl shadow-black/50">
      <div className="text-[#555570] mb-3 text-[13px] font-semibold uppercase tracking-wider">{label}</div>
      {payload.map((p, i) => (
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

const FREQS = ['monthly', 'quarterly', 'semiannual', 'annual'];
const FREQ_LABELS = { monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'Semi-Annual', annual: 'Annual' };
const FREQ_COLORS = { monthly: '#ef4444', quarterly: '#eab308', semiannual: '#22c55e', annual: '#3b82f6' };

export default function WithdrawalChart({ series, benchmark }) {
  const [timeRange, setTimeRange] = useState('all');
  const isUsd = benchmark === 'usd';

  const results = useMemo(() => {
    const out = {};
    for (const freq of FREQS) {
      out[freq] = simulateWithdrawals(series, freq);
    }
    return out;
  }, [series]);

  const chartData = useMemo(() => {
    const filtered = filterByTimeRange(series, timeRange);
    const step = Math.max(1, Math.floor(filtered.length / 400));
    return filtered
      .filter((_, i) => i % step === 0 || i === filtered.length - 1)
      .map((s, idx) => {
        const origIdx = series.indexOf(s);
        const entry = { dateLabel: formatDateShort(s.date), compound: isUsd ? s.btc * s.btcUsd : s.btc };
        for (const freq of FREQS) {
          const ws = results[freq].series;
          if (origIdx < ws.length) {
            entry[freq] = isUsd ? ws[origIdx].btc * s.btcUsd : ws[origIdx].btc;
          }
        }
        return entry;
      });
  }, [series, results, timeRange, isUsd]);

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-2xl px-6 py-5">
          <div className="text-[13px] text-[#555570] uppercase tracking-wider mb-2 font-semibold">Compound (No Withdrawal)</div>
          <div className="text-xl font-mono font-bold text-[#f7931a] tabular-nums">
            {isUsd ? `$${(series[series.length - 1]?.btc * series[series.length - 1]?.btcUsd).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : series[series.length - 1]?.btc.toFixed(4)}
          </div>
        </div>
        {FREQS.map(freq => (
          <div key={freq} className="bg-[#0d0d17] border border-[#1a1a2e] rounded-2xl px-6 py-5">
            <div className="text-[13px] text-[#555570] uppercase tracking-wider mb-2 font-semibold">{FREQ_LABELS[freq]}</div>
            <div className="text-sm font-mono tabular-nums font-semibold" style={{ color: FREQ_COLORS[freq] }}>
              Balance: {isUsd ? `$${(results[freq].finalBalance * (series[series.length - 1]?.btcUsd || 85000)).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : results[freq].finalBalance.toFixed(4)}
            </div>
            <div className="text-[12px] font-mono text-[#22c55e] tabular-nums mt-1">
              Withdrawn: {isUsd ? `$${(results[freq].totalWithdrawn * (series[series.length - 1]?.btcUsd || 85000)).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : results[freq].totalWithdrawn.toFixed(4)}
            </div>
            <div className="text-[13px] text-[#555570] mt-1">Yield: {results[freq].effectiveYield}%</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-3xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-[#f0f0f8]">Withdrawal Simulator</h2>
            <p className="text-[13px] text-[#555570] mt-1">Compound vs periodic profit withdrawals</p>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <ResponsiveContainer width="100%" height={450}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: isUsd ? 10 : -5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 12, fill: '#555570' }} axisLine={{ stroke: '#1a1a2e' }} tickLine={false} interval={Math.floor(chartData.length / 7)} />
            <YAxis tick={{ fontSize: 12, fill: '#555570' }} axisLine={false} tickLine={false}
              tickFormatter={v => isUsd ? `$${(v / 1000).toFixed(0)}k` : v.toFixed(2)} />
            <Tooltip content={<ChartTooltip isUsd={isUsd} />} />
            <Line type="monotone" dataKey="compound" name="Compound" stroke="#f7931a" strokeWidth={3} dot={false} />
            {FREQS.map(freq => (
              <Line key={freq} type="monotone" dataKey={freq} name={FREQ_LABELS[freq]} stroke={FREQ_COLORS[freq]} strokeWidth={2.5} dot={false} strokeDasharray={freq === 'monthly' ? '4 2' : undefined} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
