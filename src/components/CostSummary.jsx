export default function CostSummary({ costs, metrics, benchmark, btcUsd }) {
  const { fees, fundingIncome, shortPnl, il, gas, slippage, swapFees, perpFees, net } = costs;
  const isUsd = benchmark === 'usd';
  const mul = isUsd ? btcUsd : 1;
  const unit = isUsd ? 'USD' : 'BTC';
  const startBtc = 1.0;

  const fmt = (v) => {
    if (isUsd) return `$${Math.abs(v * mul).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    return Math.abs(v).toFixed(6);
  };

  // Build rows — decomposed P&L with funding + short P&L separate
  // Engine reports cost magnitudes as positive values; we negate for display.
  const compoundEffect = costs.compoundEffect || 0;
  const allRows = [
    { label: 'Pool Fees', btc: fees },
    { label: 'Funding Income', btc: fundingIncome || 0 },
    { label: 'Short P&L', btc: shortPnl || 0 },
    { label: 'Impermanent Loss', btc: -(Math.abs(il || 0)) },
    { label: 'Gas Costs', btc: -(Math.abs(gas || 0)) },
    { label: 'Slippage', btc: -(Math.abs(slippage || 0)) },
    { label: 'Swap Fees', btc: -(Math.abs(swapFees || 0)) },
    { label: 'Perp Fees', btc: -(Math.abs(perpFees || 0)) },
    // Compound effect: difference between true net (finalBtc - 1) and linear sum of components
    ...(Math.abs(compoundEffect) > 0.000001 ? [{ label: 'Compound Effect', btc: compoundEffect }] : []),
  ];

  const rows = allRows.filter(r => Math.abs(r.btc) > 0.000001);

  const daysOut = metrics.daysOutOfRange || 0;
  const feesMissed = metrics.feesMissed || 0;
  const marginStops = metrics.marginStops || 0;
  const cooldownDays = metrics.cooldownDays || 0;
  const hedgeActivePct = metrics.hedgeActivePct || 0;

  return (
    <div className="bg-[#0d0d17] border border-[#1a1a2e] rounded-3xl p-8 h-full flex flex-col">
      <h2 className="text-base font-bold text-[#f0f0f8] mb-1.5">P&L Breakdown</h2>
      <p className="text-[13px] text-[#555570] mb-6">All values in {unit}</p>

      <div className="flex-1 space-y-1.5">
        {rows.map(row => {
          const pct = (row.btc / startBtc * 100);
          const isPositive = row.btc >= 0;
          const barWidth = Math.min(100, Math.abs(pct));
          return (
            <div key={row.label} className="group py-2.5 px-4 rounded-xl hover:bg-[rgba(255,255,255,0.02)] transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] text-[#8888a8] group-hover:text-[#f0f0f8] transition-colors">{row.label}</span>
                <div className="flex items-center gap-4">
                  <span className={`text-[13px] font-mono tabular-nums font-semibold ${isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {isPositive ? '+' : '-'}{fmt(row.btc)}
                  </span>
                  <span className={`text-[13px] font-mono tabular-nums w-[55px] text-right ${isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'} opacity-50`}>
                    {isPositive ? '+' : ''}{pct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-[3px] bg-[#1a1a2e] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${isPositive ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}
                  style={{ width: `${barWidth}%`, opacity: 0.5 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Operational metrics */}
      {(daysOut > 0 || feesMissed > 0 || marginStops > 0 || cooldownDays > 0) && (
        <div className="mt-4 pt-4 border-t border-[#1a1a2e]/50 space-y-2 px-4">
          {marginStops > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#8888a8]">Margin Stops</span>
              <span className="text-[13px] font-mono tabular-nums text-[#ef4444] font-semibold">{marginStops}</span>
            </div>
          )}
          {cooldownDays > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#8888a8]">Days in Cooldown</span>
              <span className="text-[13px] font-mono tabular-nums text-[#f7931a] font-semibold">{cooldownDays} ({metrics.cooldownPct}%)</span>
            </div>
          )}
          {hedgeActivePct > 0 && hedgeActivePct < 100 && (
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#8888a8]">Hedge Active</span>
              <span className="text-[13px] font-mono tabular-nums text-[#22c55e] font-semibold">{hedgeActivePct}%</span>
            </div>
          )}
          {daysOut > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#8888a8]">Days Out of Range</span>
              <span className="text-[13px] font-mono tabular-nums text-[#f7931a] font-semibold">{daysOut}</span>
            </div>
          )}
          {feesMissed > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#8888a8]">Fees Lost to Delay</span>
              <span className="text-[13px] font-mono tabular-nums text-[#ef4444] font-semibold">-{fmt(feesMissed)}</span>
            </div>
          )}
        </div>
      )}

      <div className={`mt-4 pt-4 border-t border-[#1a1a2e] px-4 py-3.5 rounded-2xl ${
        net >= 0 ? 'bg-[rgba(34,197,94,0.04)]' : 'bg-[rgba(239,68,68,0.04)]'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-[#f0f0f8]">Net P&L</span>
          <div className="flex items-center gap-4">
            <span className={`text-lg font-mono font-bold tabular-nums ${net >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {net >= 0 ? '+' : '-'}{isUsd ? `$${Math.abs(net * mul).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : Math.abs(net).toFixed(6)}
            </span>
            <span className={`text-xs font-mono tabular-nums ${net >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'} opacity-60`}>
              {net >= 0 ? '+' : ''}{(net / startBtc * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
