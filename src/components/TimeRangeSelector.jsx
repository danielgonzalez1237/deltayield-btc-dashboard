const RANGES = [
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: 'ytd', label: 'YTD' },
  { value: '1y', label: '1Y' },
  { value: '3y', label: '3Y' },
  { value: '5y', label: '5Y' },
  { value: 'all', label: 'All' },
];

export default function TimeRangeSelector({ value, onChange }) {
  return (
    <div className="flex bg-[#0a0a14] border border-[#1a1a2e] rounded-xl p-1 gap-0.5">
      {RANGES.map(r => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`px-3.5 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
            value === r.value
              ? 'bg-[#f7931a] text-black shadow-sm'
              : 'text-[#555570] hover:text-[#f0f0f8] hover:bg-[rgba(255,255,255,0.04)]'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
