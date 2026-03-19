import { formatDate } from '../engine';

export default function ScenarioTable({ scenarios, benchmark, btcUsd }) {
  const sorted = [...scenarios].sort((a, b) => b.result.metrics.cagr - a.result.metrics.cagr);
  const isUsd = benchmark === 'usd';
  const mul = isUsd ? btcUsd : 1;
  const fmt = (v) => isUsd ? `$${(v * mul).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : v.toFixed(4);

  return (
    <div className="bg-[#111119] border border-[#1f1f30] rounded-2xl p-5">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-[#eaeaf2]">Scenario Comparison</h2>
        <p className="text-[10px] text-[#4e4e66] mt-0.5">All 10 configurations ranked by CAGR (8 base + 2 hybrid)</p>
      </div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-[11px] min-w-[900px]">
          <thead>
            <tr className="text-[#4e4e66] text-[10px] uppercase tracking-[0.08em]">
              <th className="text-left py-2 px-2 font-semibold">#</th>
              <th className="text-left py-2 px-2 font-semibold">Scenario</th>
              <th className="text-right py-2 px-2 font-semibold">Final {isUsd ? 'USD' : 'BTC'}</th>
              <th className="text-right py-2 px-2 font-semibold">CAGR</th>
              <th className="text-right py-2 px-2 font-semibold">Max DD</th>
              <th className="text-right py-2 px-2 font-semibold">CAGR/DD</th>
              <th className="text-right py-2 px-2 font-semibold">Fees</th>
              <th className="text-right py-2 px-2 font-semibold">Hedge</th>
              <th className="text-right py-2 px-2 font-semibold">IL</th>
              <th className="text-right py-2 px-2 font-semibold">Net P&L</th>
              <th className="text-right py-2 px-2 font-semibold">Rebal</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const m = s.result.metrics;
              const c = s.result.costs;
              const best = i === 0;
              return (
                <tr key={s.key}
                  className={`border-t border-[#1f1f30] transition-colors hover:bg-[rgba(255,255,255,0.015)] ${best ? 'bg-[rgba(247,147,26,0.03)]' : ''}`}>
                  <td className="py-3 px-2 font-mono text-[#4e4e66]">
                    {best ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[rgba(247,147,26,0.12)] text-[#f7931a] text-[10px] font-bold">1</span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-5 h-5 text-[10px]">{i + 1}</span>
                    )}
                  </td>
                  <td className="py-3 px-2 font-medium text-[#eaeaf2] whitespace-nowrap">{s.key}</td>
                  <td className="py-3 px-2 text-right font-mono tabular-nums text-[#f7931a]">{fmt(m.finalBtc)}</td>
                  <td className={`py-3 px-2 text-right font-mono tabular-nums font-medium ${m.cagr >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                    {m.cagr.toFixed(2)}%
                  </td>
                  <td className="py-3 px-2 text-right font-mono tabular-nums text-[#f87171]">{m.maxDD.toFixed(2)}%</td>
                  <td className="py-3 px-2 text-right font-mono tabular-nums text-[#60a5fa]">
                    {m.cagrDdRatio === Infinity || m.cagrDdRatio === 0 ? '—' : m.cagrDdRatio.toFixed(1)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono tabular-nums text-[#34d399]">+{fmt(c.fees)}</td>
                  <td className={`py-3 px-2 text-right font-mono tabular-nums ${c.hedge > 0 ? 'text-[#34d399]' : 'text-[#4e4e66]'}`}>
                    {c.hedge > 0 ? `+${fmt(c.hedge)}` : fmt(c.hedge)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono tabular-nums text-[#f87171]">-{fmt(c.il)}</td>
                  <td className={`py-3 px-2 text-right font-mono tabular-nums font-semibold ${c.net >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                    {c.net >= 0 ? '+' : ''}{fmt(c.net)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono tabular-nums text-[#4e4e66]">{m.rebalanceCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
