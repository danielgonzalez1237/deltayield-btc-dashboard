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
    <div className="bg-[#16161f] border border-[#2a2a40] rounded-xl px-4 py-3 text-xs shadow-2xl shadow-black/40">
      <div className="text-[#4e4e66] mb-2 text-[10px] font-semibold uppercase tracking-wider">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-6 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-[#7a7a96]">{p.name}</span>
          </span>
          <span className="font-mono text-[#eaeaf2] tabular-nums">
            {isUsd ? `$${(p.value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : (p.value || 0).toFixed(4)}
          </span>
        </div>
      ))}
    </div>
  );
}

const FREQS = ['monthly', 'quarterly', 'semiannual', 'annual'];
const FREQ_LABELS = { monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'Semi-Annual', annual: 'Annual' };
const FREQ_COLORS = { monthly: '#f87171', quarterly: '#fbbf24', semiannual: '#34d399', annual: '#60a5fa' };

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
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-[#111119] border border-[#1f1f30] rounded-xl px-4 py-3">
          <div className="text-[10px] text-[#4e4e66] uppercase tracking-wider mb-1">Compound (No Withdrawal)</div>
          <div className="text-lg font-mono font-semibold text-[#f7931a] tabular-nums">
            {isUsd ? `$${(series[series.length - 1]?.btc * series[series.length - 1]?.btcUsd).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : series[series.length - 1]?.btc.toFixed(4)}
          </div>
        </div>
        {FREQS.map(freq => (
          <div key={freq} className="bg-[#111119] border border-[#1f1f30] rounded-xl px-4 py-3">
            <div className="text-[10px] text-[#4e4e66] uppercase tracking-wider mb-1">{FREQ_LABELS[freq]}</div>
            <div className="text-sm font-mono tabular-nums" style={{ color: FREQ_COLORS[freq] }}>
              Balance: {isUsd ? `$${(results[freq].finalBalance * (series[series.length - 1]?.btcUsd || 85000)).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : results[freq].finalBalance.toFixed(4)}
            </div>
            <div className="text-xs font-mono text-[#34d399] tabular-nums mt-0.5">
              Withdrawn: {isUsd ? `$${(results[freq].totalWithdrawn * (series[series.length - 1]?.btcUsd || 85000)).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : results[freq].totalWithdrawn.toFixed(4)}
            </div>
            <div className="text-[10px] text-[#4e4e66] mt-0.5">Yield: {results[freq].effectiveYield}%</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-[#111119] border border-[#1f1f30] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#eaeaf2]">Withdrawal Simulator</h2>
            <p className="text-[10px] text-[#4e4e66] mt-0.5">Compound vs periodic profit withdrawals</p>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: isUsd ? 10 : -5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#4e4e66' }} axisLine={{ stroke: '#1f1f30' }} tickLine={false} interval={Math.floor(chartData.length / 7)} />
            <YAxis tick={{ fontSize: 10, fill: '#4e4e66' }} axisLine={false} tickLine={false}
              tickFormatter={v => isUsd ? `$${(v / 1000).toFixed(0)}k` : v.toFixed(2)} />
            <Tooltip content={<ChartTooltip isUsd={isUsd} />} />
            <Line type="monotone" dataKey="compound" name="Compound" stroke="#f7931a" strokeWidth={2} dot={false} />
            {FREQS.map(freq => (
              <Line key={freq} type="monotone" dataKey={freq} name={FREQ_LABELS[freq]} stroke={FREQ_COLORS[freq]} strokeWidth={1.5} dot={false} strokeDasharray={freq === 'monthly' ? '4 2' : undefined} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
