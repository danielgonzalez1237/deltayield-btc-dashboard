import { useState } from 'react';
import { formatDate } from '../engine';

const REASON_BADGES = {
  rebalance: { label: 'Rebalance', bg: 'bg-[#3b82f6]', text: 'text-white' },
  margin_stop: { label: 'Margin Stop', bg: 'bg-[#ef4444]', text: 'text-white' },
  sma_off: { label: 'SMA Off', bg: 'bg-[#f7931a]', text: 'text-black' },
  end: { label: 'End', bg: 'bg-[#555570]', text: 'text-white' },
};

function ReasonBadge({ reason }) {
  const badge = REASON_BADGES[reason] || { label: reason || '—', bg: 'bg-[#555570]', text: 'text-white' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  );
}

function Chip({ label, value, color }) {
  return (
    <div className="bg-[#0a0a14] border border-[#1a1a2e] rounded-xl px-4 py-3">
      <div className="text-[13px] text-[#555570] uppercase tracking-wider mb-1 font-semibold">{label}</div>
      <div className="text-[12px] font-mono tabular-nums font-semibold" style={{ color: color || '#f0f0f8' }}>{value}</div>
    </div>
  );
}

function PositionCard({ position, index, benchmark, btcUsd }) {
  const [open, setOpen] = useState(false);
  const {
    entryDate, exitDate, entryPrice, exitPrice,
    entryBtc, exitBtc, fees, hedgePnl, fundingIncome, shortPnl, il, gas,
    slippage, swapFees, perpFees, rebalances, closeReason,
    hedgeEnabled, hedgeRatio, mitigantState,
    entryWbtcPct, exitWbtcPct, exitWethPct,
  } = position;

  const isUsd = benchmark === 'usd';
  const mul = isUsd ? btcUsd : 1;
  const days = Math.round((new Date(exitDate) - new Date(entryDate)) / 86400000);
  const priceChange = entryPrice && exitPrice ? ((exitPrice / entryPrice - 1) * 100) : 0;
  const netPnl = fees + (hedgePnl || 0) - il - gas - slippage - swapFees - perpFees;

  const fmtBtc = (v) => isUsd ? `$${(v * mul).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : v.toFixed(5);

  // Hedge status label
  const hedgeLabel = hedgeEnabled === false ? 'Unhedged'
    : hedgeRatio >= 0.45 ? `Hedged ${Math.round(hedgeRatio * 100)}%`
    : hedgeRatio > 0 ? `Hedged ${Math.round(hedgeRatio * 100)}%`
    : 'Unhedged';
  const hedgeColor = hedgeEnabled ? '#22c55e' : '#555570';

  return (
    <div className={`bg-[#0d0d17] border rounded-2xl overflow-hidden transition-all ${open ? 'border-[#252540]' : 'border-[#1a1a2e]'}`}>
      <button onClick={() => setOpen(!open)}
        className="w-full px-6 py-5 flex items-center justify-between hover:bg-[rgba(255,255,255,0.01)] transition-colors text-left">
        <div className="flex items-center gap-5">
          <div className="w-8 h-8 rounded-xl bg-[#0a0a14] border border-[#1a1a2e] flex items-center justify-center text-[13px] font-mono text-[#555570] font-bold">
            {index + 1}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-[#f0f0f8] font-semibold">
                {formatDate(entryDate)} <span className="text-[#555570] mx-1">&rarr;</span> {formatDate(exitDate)}
              </span>
              <ReasonBadge reason={closeReason} />
              {hedgeEnabled != null && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border" style={{
                  color: hedgeColor,
                  borderColor: hedgeColor + '40',
                  backgroundColor: hedgeColor + '10',
                }}>{hedgeLabel}</span>
              )}
            </div>
            <div className="text-[13px] text-[#555570] mt-1">{days}d</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <div className="text-[13px] text-[#555570] font-semibold uppercase">Fees</div>
            <div className="text-[13px] font-mono tabular-nums text-[#22c55e] font-semibold">+{fmtBtc(fees)}</div>
          </div>
          {(shortPnl != null && Math.abs(shortPnl) > 0.000001) && (
            <div className="text-right hidden sm:block">
              <div className="text-[13px] text-[#555570] font-semibold uppercase">Short</div>
              <div className={`text-[13px] font-mono tabular-nums font-semibold ${shortPnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {shortPnl >= 0 ? '+' : ''}{fmtBtc(shortPnl)}
              </div>
            </div>
          )}
          <div className="text-right hidden sm:block">
            <div className="text-[13px] text-[#555570] font-semibold uppercase">IL</div>
            <div className="text-[13px] font-mono tabular-nums text-[#ef4444] font-semibold">-{fmtBtc(il)}</div>
          </div>
          <div className="text-right">
            <div className="text-[13px] text-[#555570] font-semibold uppercase">Net</div>
            <div className={`text-[13px] font-mono tabular-nums font-bold ${netPnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {netPnl >= 0 ? '+' : ''}{fmtBtc(netPnl)}
            </div>
          </div>
          <div className="text-right min-w-[110px] hidden md:block">
            <div className="text-[13px] text-[#555570] font-semibold uppercase">Balance</div>
            <div className="text-[13px] font-mono tabular-nums text-[#f0f0f8]">
              {fmtBtc(entryBtc)} &rarr; {fmtBtc(exitBtc || 0)}
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555570" strokeWidth="2"
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-6 pb-6 pt-0 border-t border-[#1a1a2e]">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3 mt-5">
            <Chip label="Entry BTC/ETH" value={entryPrice ? (1/entryPrice).toFixed(2) : '—'} />
            <Chip label="Exit BTC/ETH" value={exitPrice ? (1/exitPrice).toFixed(2) : '—'} />
            <Chip label="Price Chg" value={`${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`} color={priceChange >= 0 ? '#22c55e' : '#ef4444'} />
            <Chip label="Fees" value={`+${fmtBtc(fees)}`} color="#22c55e" />
            {fundingIncome != null && (
              <Chip label="Funding" value={`${fundingIncome >= 0 ? '+' : ''}${fmtBtc(fundingIncome)}`} color={fundingIncome >= 0 ? '#22c55e' : '#ef4444'} />
            )}
            {shortPnl != null && (
              <Chip label="Short P&L" value={`${shortPnl >= 0 ? '+' : ''}${fmtBtc(shortPnl)}`} color={shortPnl >= 0 ? '#22c55e' : '#ef4444'} />
            )}
            <Chip label="IL" value={`-${fmtBtc(il)}`} color="#ef4444" />
            <Chip label="Gas" value={`-${fmtBtc(gas)}`} color="#ef4444" />
            <Chip label="Slippage" value={`-${fmtBtc(slippage)}`} color="#ef4444" />
            <Chip label="Swap Fees" value={`-${fmtBtc(swapFees)}`} color="#ef4444" />
            <Chip label="Perp Fees" value={`-${fmtBtc(perpFees)}`} color="#ef4444" />
            <Chip label="Duration" value={`${days} days`} />
            {mitigantState && (
              <>
                <Chip label="Hedge Ratio" value={`${Math.round((hedgeRatio || 0) * 100)}%`} color={hedgeEnabled ? '#22c55e' : '#555570'} />
                {mitigantState.m4_cooldownMultiplier > 1 && (
                  <Chip label="CD Multiplier" value={`${mitigantState.m4_cooldownMultiplier}x`} color="#a855f7" />
                )}
                {mitigantState.m1_stopsInWindow > 0 && (
                  <Chip label="Stops in Window" value={mitigantState.m1_stopsInWindow} color="#ef4444" />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PositionCards({ positions, benchmark, btcUsd }) {
  const marginStops = positions.filter(p => p.closeReason === 'margin_stop').length;
  const rebalances = positions.filter(p => p.closeReason === 'rebalance').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <h2 className="text-base font-bold text-[#f0f0f8]">Positions</h2>
          <span className="text-[13px] font-semibold text-[#555570] bg-[#0a0a14] border border-[#1a1a2e] px-3 py-1 rounded-full">
            {positions.length}
          </span>
          {marginStops > 0 && (
            <span className="text-[11px] font-bold text-[#ef4444] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] px-2.5 py-1 rounded-lg">
              {marginStops} stops
            </span>
          )}
          {rebalances > 0 && (
            <span className="text-[11px] font-bold text-[#3b82f6] bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.2)] px-2.5 py-1 rounded-lg">
              {rebalances} rebalances
            </span>
          )}
        </div>
      </div>
      {positions.map((p, i) => (
        <PositionCard key={i} position={p} index={i} benchmark={benchmark} btcUsd={btcUsd} />
      ))}
    </div>
  );
}
