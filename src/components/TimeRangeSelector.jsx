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
    <div className="flex bg-[#0c0c14] border border-[#1f1f30] rounded-lg p-[2px] gap-[1px]">
      {RANGES.map(r => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${
            value === r.value
              ? 'bg-[#f7931a] text-black shadow-sm'
              : 'text-[#4e4e66] hover:text-[#eaeaf2] hover:bg-[rgba(255,255,255,0.03)]'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
