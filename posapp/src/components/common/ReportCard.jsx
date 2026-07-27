// Section wrapper for report/dashboard widgets (a chart, a stat block, a
// small table) — a titled pos-card with an optional colored icon badge and a
// hover lift so the page reads as explorable rather than static. accent:
// "primary" | "success" | "warning" | "danger" | "neutral". Reuse for any new
// report widget instead of hand-rolling the card header markup.
const ReportCard = ({ title, icon, accent = "primary", actions, children, className = "" }) => (
  <div className={`pos-card pos-card-interactive p-3 ${className}`.trim()}>
    {(title || actions) && (
      <div className="d-flex align-items-center justify-content-between mb-3 gap-2">
        {title && (
          <div className="d-flex align-items-center gap-2">
            {icon && (
              <div className={`pos-icon-badge ${accent}`} style={{ width: 28, height: 28, fontSize: 13 }}>
                <i className={`bi ${icon}`} />
              </div>
            )}
            <h6 className="mb-0" style={{ fontSize: 14 }}>
              {title}
            </h6>
          </div>
        )}
        {actions}
      </div>
    )}
    {children}
  </div>
);

export default ReportCard;
