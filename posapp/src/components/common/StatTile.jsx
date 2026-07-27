// KPI tile for report/dashboard pages — a colored icon badge next to a muted
// label and large value, with a hover lift. accent: "primary" | "success" |
// "warning" | "danger" | "neutral". Reuse in any grid of summary numbers
// instead of hand-rolling stat markup.
const StatTile = ({ label, value, icon, accent = "primary", className = "" }) => (
  <div className={`pos-stat-tile ${className}`.trim()}>
    {icon && (
      <div className={`pos-icon-badge ${accent}`}>
        <i className={`bi ${icon}`} />
      </div>
    )}
    <div className="pos-stat-body">
      <p className="pos-stat-label">{label}</p>
      <p className="pos-stat-value">{value}</p>
    </div>
  </div>
);

export default StatTile;
