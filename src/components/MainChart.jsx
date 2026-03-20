import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { useMemo, useState } from 'react';
import { filterByTimeRange, formatDateShort, formatDate } from '../engine';
import TimeRangeSelector from './TimeRangeSelector';

const FREQ_LABELS = { monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'Semi-Annual', annual: 'Annual' };

function ChartTooltip({ active, payload, label, benchmark }) {
  if (!active || !payload?.length) return null;
  const isUsd = benchmark === 'usd';
  return (
    <div className="bg-[#12121e] border border-[#252540] rounded-2xl px-5 py-4 text-xs shadow-2xl shadow-black/50">
      <div className="text-[#8888a8] mb-3 text-[13px] font-semibold uppercase tracking-wider">{label}</div>
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

  const lastBtcUsd = series[series.length - 1]?.btcUsd || 85000;
  const fmtBtc = (v) => isUsd ? `$${(v * lastBtcUsd).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : v.toFixed(6);

  return (
    <div className="space-y-6">
      {/* Withdrawal impact summary bar */}
      {hasWithdrawal && (
        <div className="bg-[#0d0d17] border border-[#a855f7]/20 rounded-2xl p-5 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />
            <span className="text-[12px] font-semibold text-[#f0f0f8]">
              {FREQ_LABELS[withdrawal]} Withdrawals Active
            </span>
          </div>
          <div className="h-5 w-px bg-[#1a1a2e]" />
          <div className="flex items-center gap-6 text-[12px]">
            <div>
              <span className="text-[#8888a8]">Remaining Balance: </span>
              <span className="font-mono font-semibold text-[#a855f7] tabular-nums">{fmtBtc(withdrawalResult.finalBalance)}</span>
            </div>
            <div>
              <span className="text-[#8888a8]">Total Withdrawn: </span>
              <span className="font-mono font-semibold text-[#22c55e] tabular-nums">{fmtBtc(withdrawalResult.totalWithdrawn)}</span>
            </div>
            <div>
              <span className="text-[#8888a8]">Effective Yield: </span>
              <span className="font-mono font-semibold text-[#22c55e] tabular-nums">{withdrawalResult.effectiveYield}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Main chart card */}
      <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-3xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-[#f0f0f8]">
              {isUsd ? 'Portfolio Value (USD)' : 'BTC Balance'}
              {hasWithdrawal && <span className="text-[#a855f7] ml-2 text-sm font-medium">+ {FREQ_LABELS[withdrawal]} Withdrawals</span>}
            </h2>
            <p className="text-[13px] text-[#555570] mt-1">
              {hasWithdrawal
                ? `Compound (orange) vs ${FREQ_LABELS[withdrawal]} profit extraction (purple)`
                : (isUsd ? 'vs $1 BTC HODL in USD' : 'vs 1 BTC HODL benchmark')}
            </p>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-5 text-[13px] mr-4">
              <span className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-[#f7931a] rounded" />
                <span className="text-[#8888a8]">{hasWithdrawal ? 'Compound' : 'Strategy'}</span>
              </span>
              {!hasWithdrawal && (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-0.5 bg-[#8888a8] rounded opacity-40" />
                  <span className="text-[#8888a8]">HODL</span>
                </span>
              )}
              {hasWithdrawal && (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-0.5 bg-[#a855f7] rounded" />
                  <span className="text-[#8888a8]">After Withdrawals</span>
                </span>
              )}
            </div>
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={450}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: isUsd ? 10 : -5, bottom: 0 }}>
            <defs>
              <linearGradient id="btcGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f7931a" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#f7931a" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="withdrawalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 12, fill: '#555570' }} axisLine={{ stroke: '#1a1a2e' }} tickLine={false} interval={Math.floor(chartData.length / 7)} />
            <YAxis domain={[yMin, yMax]} tick={{ fontSize: 12, fill: '#555570' }} axisLine={false} tickLine={false}
              tickFormatter={v => isUsd ? `$${(v / 1000).toFixed(0)}k` : v.toFixed(2)} />
            <Tooltip content={<ChartTooltip benchmark={benchmark} />} />
            <Area type="monotone" dataKey="btc" name={hasWithdrawal ? 'Compound' : 'Strategy'} stroke="#f7931a" fill="url(#btcGradient)" strokeWidth={2.5} dot={false} animationDuration={400} />
            {!hasWithdrawal && <Line type="monotone" dataKey="benchmark" name="HODL" stroke="#8888a8" strokeWidth={1} strokeDasharray="6 4" strokeOpacity={0.3} dot={false} />}
            {hasWithdrawal && <Area type="monotone" dataKey="withdrawalBtc" name="After Withdrawals" stroke="#a855f7" fill="url(#withdrawalGradient)" strokeWidth={2.5} dot={false} animationDuration={400} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Withdrawal extractions table */}
      {hasWithdrawal && withdrawalResult.withdrawals?.length > 0 && (
        <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-3xl p-8">
          <h3 className="text-sm font-bold text-[#f0f0f8] mb-1">Extraction History</h3>
          <p className="text-[13px] text-[#555570] mb-5">
            {withdrawalResult.withdrawals.length} extractions — {FREQ_LABELS[withdrawal]} profit withdrawal
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#1a1a2e]">
                  <th className="text-left py-3 px-3 text-[#555570] font-semibold uppercase tracking-wider text-[13px]">#</th>
                  <th className="text-left py-3 px-3 text-[#555570] font-semibold uppercase tracking-wider text-[13px]">Date</th>
                  <th className="text-right py-3 px-3 text-[#555570] font-semibold uppercase tracking-wider text-[13px]">Extracted</th>
                  <th className="text-right py-3 px-3 text-[#555570] font-semibold uppercase tracking-wider text-[13px]">Total Withdrawn</th>
                </tr>
              </thead>
              <tbody>
                {withdrawalResult.withdrawals.map((w, i) => (
                  <tr key={i} className="border-b border-[#1a1a2e]/30 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="py-2.5 px-3 text-[#555570]">{i + 1}</td>
                    <td className="py-2.5 px-3 text-[#8888a8] font-mono tabular-nums">{formatDate(w.date)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#22c55e] font-semibold">
                      +{fmtBtc(w.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#8888a8]">
                      {fmtBtc(w.totalWithdrawn)}
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
