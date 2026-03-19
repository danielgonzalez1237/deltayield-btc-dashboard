import { useState } from 'react';

function Chip({ label, value, color }) {
  return (
    <div className="bg-[#0c0c14] border border-[#1f1f30] rounded-lg px-3 py-2">
      <div className="text-[10px] text-[#4e4e66] uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-[11px] font-mono tabular-nums" style={{ color: color || '#eaeaf2' }}>{value}</div>
    </div>
  );
}

function PositionCard({ position, index }) {
  const [open, setOpen] = useState(false);
  const {
    entryDate, exitDate, entryPrice, exitPrice,
    entryBtc, exitBtc, fees, hedgePnl, il, gas,
    slippage, swapFees, perpFees, rebalances,
    entryWbtcPct, exitWbtcPct, exitWethPct,
  } = position;

  const days = Math.round((new Date(exitDate) - new Date(entryDate)) / 86400000);
  const priceChange = entryPrice && exitPrice ? ((exitPrice / entryPrice - 1) * 100) : 0;
  const netPnl = fees + hedgePnl - il - gas - slippage - swapFees - perpFees;

  return (
    <div className={`bg-[#111119] border rounded-xl overflow-hidden transition-colors ${open ? 'border-[#2a2a40]' : 'border-[#1f1f30]'}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-[rgba(255,255,255,0.01)] transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-7 h-7 rounded-lg bg-[#0c0c14] border border-[#1f1f30] flex items-center justify-center text-[10px] font-mono text-[#4e4e66]">
            {index + 1}
          </div>
          <div>
            <div className="text-xs text-[#eaeaf2] font-medium">
              {entryDate} <span className="text-[#4e4e66] mx-1">→</span> {exitDate}
            </div>
            <div className="text-[10px] text-[#4e4e66] mt-0.5">
              {days}d &middot; {rebalances} rebal
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-[#4e4e66]">Fees</div>
            <div className="text-xs font-mono tabular-nums text-[#34d399]">+{fees.toFixed(5)}</div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-[#4e4e66]">IL</div>
            <div className="text-xs font-mono tabular-nums text-[#f87171]">-{il.toFixed(5)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[#4e4e66]">Net</div>
            <div className={`text-xs font-mono tabular-nums font-medium ${netPnl >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
              {netPnl >= 0 ? '+' : ''}{netPnl.toFixed(5)}
            </div>
          </div>
          <div className="text-right min-w-[100px] hidden md:block">
            <div className="text-[10px] text-[#4e4e66]">Balance</div>
            <div className="text-xs font-mono tabular-nums text-[#eaeaf2]">
              {entryBtc.toFixed(4)} → {(exitBtc || 0).toFixed(4)}
            </div>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4e4e66" strokeWidth="2"
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-0 border-t border-[#1f1f30]">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2 mt-4">
            <Chip label="Entry Price" value={entryPrice?.toFixed(6)} />
            <Chip label="Exit Price" value={exitPrice?.toFixed(6)} />
            <Chip label="Price Chg" value={`${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`} color={priceChange >= 0 ? '#34d399' : '#f87171'} />
            <Chip label="Fees" value={`+${fees.toFixed(6)}`} color="#34d399" />
            <Chip label="Hedge P&L" value={`${hedgePnl >= 0 ? '+' : ''}${hedgePnl.toFixed(6)}`} color={hedgePnl >= 0 ? '#34d399' : '#f87171'} />
            <Chip label="IL" value={`-${il.toFixed(6)}`} color="#f87171" />
            <Chip label="Gas" value={`-${gas.toFixed(6)}`} color="#f87171" />
            <Chip label="Slippage" value={`-${slippage.toFixed(6)}`} color="#f87171" />
            <Chip label="Swap Fees" value={`-${swapFees.toFixed(6)}`} color="#f87171" />
            <Chip label="Perp Fees" value={`-${perpFees.toFixed(6)}`} color="#f87171" />
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

export default function PositionCards({ positions }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#eaeaf2]">
          Positions
          <span className="ml-2 text-[10px] font-normal text-[#4e4e66] bg-[#0c0c14] border border-[#1f1f30] px-2 py-0.5 rounded-full">
            {positions.length}
          </span>
        </h2>
      </div>
      {positions.map((p, i) => (
        <PositionCard key={i} position={p} index={i} />
      ))}
    </div>
  );
}
