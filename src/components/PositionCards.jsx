import { useState } from 'react';
import { formatDate } from '../engine';

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
    entryBtc, exitBtc, fees, hedgePnl, il, gas,
    slippage, swapFees, perpFees, rebalances,
    entryWbtcPct, exitWbtcPct, exitWethPct,
  } = position;

  const isUsd = benchmark === 'usd';
  const mul = isUsd ? btcUsd : 1;
  const days = Math.round((new Date(exitDate) - new Date(entryDate)) / 86400000);
  const priceChange = entryPrice && exitPrice ? ((exitPrice / entryPrice - 1) * 100) : 0;
  const netPnl = fees + hedgePnl - il - gas - slippage - swapFees - perpFees;

  const fmtBtc = (v) => isUsd ? `$${(v * mul).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : v.toFixed(5);

  return (
    <div className={`bg-[#0d0d17] border rounded-2xl overflow-hidden transition-all ${open ? 'border-[#252540]' : 'border-[#1a1a2e]'}`}>
      <button onClick={() => setOpen(!open)}
        className="w-full px-6 py-5 flex items-center justify-between hover:bg-[rgba(255,255,255,0.01)] transition-colors text-left">
        <div className="flex items-center gap-5">
          <div className="w-8 h-8 rounded-xl bg-[#0a0a14] border border-[#1a1a2e] flex items-center justify-center text-[13px] font-mono text-[#555570] font-bold">
            {index + 1}
          </div>
          <div>
            <div className="text-[13px] text-[#f0f0f8] font-semibold">
              {formatDate(entryDate)} <span className="text-[#555570] mx-1.5">&rarr;</span> {formatDate(exitDate)}
            </div>
            <div className="text-[13px] text-[#555570] mt-1">{days}d &middot; {rebalances} rebal</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <div className="text-[13px] text-[#555570] font-semibold uppercase">Fees</div>
            <div className="text-[13px] font-mono tabular-nums text-[#22c55e] font-semibold">+{fmtBtc(fees)}</div>
          </div>
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
            <Chip label="Hedge P&L" value={`${hedgePnl >= 0 ? '+' : ''}${fmtBtc(hedgePnl)}`} color={hedgePnl >= 0 ? '#22c55e' : '#ef4444'} />
            <Chip label="IL" value={`-${fmtBtc(il)}`} color="#ef4444" />
            <Chip label="Gas" value={`-${fmtBtc(gas)}`} color="#ef4444" />
            <Chip label="Slippage" value={`-${fmtBtc(slippage)}`} color="#ef4444" />
            <Chip label="Swap Fees" value={`-${fmtBtc(swapFees)}`} color="#ef4444" />
            <Chip label="Perp Fees" value={`-${fmtBtc(perpFees)}`} color="#ef4444" />
            <Chip label="Rebalances" value={rebalances} />
            <Chip label="Entry W/W" value={`${(entryWbtcPct * 100).toFixed(0)}/${((1 - entryWbtcPct) * 100).toFixed(0)}`} />
            <Chip label="Exit W/W" value={exitWbtcPct != null ? `${(exitWbtcPct * 100).toFixed(0)}/${(exitWethPct * 100).toFixed(0)}` : '—'} />
            <Chip label="Duration" value={`${days} days`} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function PositionCards({ positions, benchmark, btcUsd }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold text-[#f0f0f8]">
          Positions
          <span className="ml-3 text-[13px] font-semibold text-[#555570] bg-[#0a0a14] border border-[#1a1a2e] px-3 py-1 rounded-full">
            {positions.length}
          </span>
        </h2>
      </div>
      {positions.map((p, i) => (
        <PositionCard key={i} position={p} index={i} benchmark={benchmark} btcUsd={btcUsd} />
      ))}
    </div>
  );
}
