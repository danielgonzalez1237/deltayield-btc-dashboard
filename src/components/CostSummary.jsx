export default function CostSummary({ costs, metrics, benchmark, btcUsd }) {
  const { fees, hedge, il, gas, slippage, swapFees, perpFees, net } = costs;
  const isUsd = benchmark === 'usd';
  const mul = isUsd ? btcUsd : 1;
  const unit = isUsd ? 'USD' : 'BTC';
  const startBtc = 1.0;

  const fmt = (v) => {
    if (isUsd) return `$${Math.abs(v * mul).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    return Math.abs(v).toFixed(6);
  };

  const rows = [
    { label: 'Fees Earned', btc: fees, type: 'income' },
    { label: 'Hedge P&L', btc: hedge, type: 'income' },
    { label: 'Impermanent Loss', btc: -il, type: 'cost' },
    { label: 'Gas Costs', btc: -gas, type: 'cost' },
    { label: 'Slippage', btc: -slippage, type: 'cost' },
    { label: 'Swap Fees', btc: -swapFees, type: 'cost' },
    { label: 'Perp Fees', btc: -perpFees, type: 'cost' },
  ];

  return (
    <div className="bg-[#111119] border border-[#1f1f30] rounded-2xl p-6 h-full flex flex-col">
      <h2 className="text-sm font-semibold text-[#eaeaf2] mb-1">P&L Breakdown</h2>
      <p className="text-[10px] text-[#4e4e66] mb-4">All values in {unit}</p>

      <div className="flex-1 space-y-1">
        {rows.map(row => {
          const pct = (row.btc / startBtc * 100);
          const isPositive = row.btc >= 0;
          const barWidth = Math.min(100, Math.abs(pct));
          return (
            <div key={row.label} className="group py-2 px-3 rounded-lg hover:bg-[rgba(255,255,255,0.02)] transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[#7a7a96] group-hover:text-[#eaeaf2] transition-colors">{row.label}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] font-mono tabular-nums ${isPositive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                    {isPositive ? '+' : '-'}{fmt(row.btc)}
                  </span>
                  <span className={`text-[10px] font-mono tabular-nums w-[52px] text-right ${isPositive ? 'text-[#34d399]' : 'text-[#f87171]'} opacity-60`}>
                    {isPositive ? '+' : ''}{pct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-[3px] bg-[#1f1f30] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${isPositive ? 'bg-[#34d399]' : 'bg-[#f87171]'}`}
                  style={{ width: `${barWidth}%`, opacity: 0.5 }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className={`mt-3 pt-3 border-t border-[#1f1f30] px-3 py-2 rounded-xl ${
        net >= 0 ? 'bg-[rgba(52,211,153,0.05)]' : 'bg-[rgba(248,113,113,0.05)]'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#eaeaf2]">Net P&L</span>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-mono font-semibold tabular-nums ${net >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
              {net >= 0 ? '+' : '-'}{isUsd ? `$${Math.abs(net * mul).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : Math.abs(net).toFixed(6)}
            </span>
            <span className={`text-xs font-mono tabular-nums ${net >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'} opacity-70`}>
              {net >= 0 ? '+' : ''}{(net / startBtc * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
