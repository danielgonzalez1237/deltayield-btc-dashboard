import { formatDate } from '../engine';

export default function ScenarioTable({ scenarios, benchmark, btcUsd }) {
  const sorted = [...scenarios].sort((a, b) => b.result.metrics.cagr - a.result.metrics.cagr);
  const isUsd = benchmark === 'usd';
  const mul = isUsd ? btcUsd : 1;
  const fmt = (v) => isUsd ? `$${(v * mul).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : v.toFixed(4);

  return (
    <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-3xl p-8">
      <div className="mb-6">
        <h2 className="text-base font-bold text-[#f0f0f8]">Scenario Comparison</h2>
        <p className="text-[11px] text-[#555570] mt-1">All 10 configurations ranked by CAGR (8 base + 2 hybrid)</p>
      </div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-[12px] min-w-[900px]">
          <thead>
            <tr className="text-[#555570] text-[10px] uppercase tracking-[0.1em]">
              <th className="text-left py-3 px-3 font-bold">#</th>
              <th className="text-left py-3 px-3 font-bold">Scenario</th>
              <th className="text-right py-3 px-3 font-bold">Final {isUsd ? 'USD' : 'BTC'}</th>
              <th className="text-right py-3 px-3 font-bold">CAGR</th>
              <th className="text-right py-3 px-3 font-bold">Max DD</th>
              <th className="text-right py-3 px-3 font-bold">CAGR/DD</th>
              <th className="text-right py-3 px-3 font-bold">Fees</th>
              <th className="text-right py-3 px-3 font-bold">Hedge</th>
              <th className="text-right py-3 px-3 font-bold">IL</th>
              <th className="text-right py-3 px-3 font-bold">Net P&L</th>
              <th className="text-right py-3 px-3 font-bold">Rebal</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const m = s.result.metrics;
              const c = s.result.costs;
              const best = i === 0;
              return (
                <tr key={s.key}
                  className={`border-t border-[#1a1a2e] transition-colors hover:bg-[rgba(255,255,255,0.02)] ${best ? 'bg-[rgba(247,147,26,0.03)]' : ''}`}>
                  <td className="py-4 px-3 font-mono text-[#555570]">
                    {best ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[rgba(247,147,26,0.1)] text-[#f7931a] text-[11px] font-bold">1</span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 text-[11px]">{i + 1}</span>
                    )}
                  </td>
                  <td className="py-4 px-3 font-semibold text-[#f0f0f8] whitespace-nowrap">{s.key}</td>
                  <td className="py-4 px-3 text-right font-mono tabular-nums text-[#f7931a] font-semibold">{fmt(m.finalBtc)}</td>
                  <td className={`py-4 px-3 text-right font-mono tabular-nums font-bold ${m.cagr >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {m.cagr.toFixed(2)}%
                  </td>
                  <td className="py-4 px-3 text-right font-mono tabular-nums text-[#ef4444]">{m.maxDD.toFixed(2)}%</td>
                  <td className="py-4 px-3 text-right font-mono tabular-nums text-[#3b82f6]">
                    {m.cagrDdRatio === Infinity || m.cagrDdRatio === 0 ? '—' : m.cagrDdRatio.toFixed(1)}
                  </td>
                  <td className="py-4 px-3 text-right font-mono tabular-nums text-[#22c55e]">+{fmt(c.fees)}</td>
                  <td className={`py-4 px-3 text-right font-mono tabular-nums ${c.hedge > 0 ? 'text-[#22c55e]' : 'text-[#555570]'}`}>
                    {c.hedge > 0 ? `+${fmt(c.hedge)}` : fmt(c.hedge)}
                  </td>
                  <td className="py-4 px-3 text-right font-mono tabular-nums text-[#ef4444]">-{fmt(c.il)}</td>
                  <td className={`py-4 px-3 text-right font-mono tabular-nums font-bold ${c.net >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {c.net >= 0 ? '+' : ''}{fmt(c.net)}
                  </td>
                  <td className="py-4 px-3 text-right font-mono tabular-nums text-[#555570]">{m.rebalanceCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
