import { Link } from "react-router-dom";

// Shared detail-page header: back link, title, optional badge/subtitle, and
// right-aligned actions. Used directly by editable detail pages
// (CustomerDetailPage, POSProfileDetailPage, ...) and internally by FormView
// for read-only detail pages.
const PageHeader = ({ title, subtitle, badge, backTo, backLabel = "Back", actions }) => (
  <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
    <div style={{ minWidth: 0 }}>
      {backTo && (
        <Link
          to={backTo}
          className="d-inline-flex align-items-center gap-1 mb-2 text-decoration-none"
          style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
        >
          <i className="bi bi-arrow-left" /> {backLabel}
        </Link>
      )}
      <div className="d-flex flex-wrap align-items-center gap-2">
        <h5 className="mb-0 text-break">{title}</h5>
        {badge}
      </div>
      {subtitle && (
        <p className="text-muted mb-0 text-break" style={{ fontSize: 13 }}>
          {subtitle}
        </p>
      )}
    </div>
    {actions && <div className="d-flex flex-wrap gap-2 flex-shrink-0">{actions}</div>}
  </div>
);

export default PageHeader;
