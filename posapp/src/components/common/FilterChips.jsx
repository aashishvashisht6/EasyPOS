// Pill-style filter chips for list-view pages (status filters, category filters).
// options: [{ label, value, danger }] — `danger` renders unselected chip in the danger palette (e.g. "Overdue").
const FilterChips = ({ options, value, onChange }) => (
  <div className="d-flex gap-2">
    {options.map((opt) => (
      <span
        key={opt.value}
        className={`pos-chip${value === opt.value ? " active" : ""}${
          opt.danger && value !== opt.value ? " danger" : ""
        }`}
        onClick={() => onChange(opt.value)}
      >
        {opt.label}
      </span>
    ))}
  </div>
);

export default FilterChips;
