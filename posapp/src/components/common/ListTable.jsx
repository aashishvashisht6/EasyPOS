import useIsMobile from "../../hooks/useIsMobile";
import { tLabel, useTranslation } from "../../translation";

// Grid-based list table for list-view pages (Invoices, Customers, etc).
// columns: [{ key, label, width (flex-basis for grid-template-columns, default "1fr"), render(row), align }]
// Shares its header/row typography, zebra striping, hover highlight, and
// monospaced numeric-column styling with ChildTable via the .pos-table-*
// classes in components.css.
//
// On phones (< 640px) rows render as stacked cards instead of grid rows. Each
// column may carry `mobile: "primary" | "secondary" | "hide"`: the primary
// column is the card's title (default: the first column), secondary columns
// show as label/value pairs, hidden ones are dropped. With no hints at all,
// the first column is the title and the next four are secondary.
const ListTable = ({
  columns,
  rows,
  rowKey = "name",
  loading = false,
  emptyMessage,
  onRowClick,
  rowStyle,
}) => {
  const { __ } = useTranslation();
  const gridTemplateColumns = columns.map((c) => c.width || "1fr").join(" ");
  const isMobile = useIsMobile();

  if (isMobile) {
    const hinted = columns.some((c) => c.mobile);
    const primary = (hinted && columns.find((c) => c.mobile === "primary")) || columns[0];
    const secondary = columns.filter((c) => c !== primary && (hinted ? c.mobile === "secondary" : true));
    const shown = hinted ? secondary : secondary.slice(0, 4);
    const cell = (c, row) => (c.render ? c.render(row) : row[c.key]);

    return (
      <div className="pos-card pos-list-cards">
        {loading ? (
          <div className="text-center py-4">
            <span className="spinner-border spinner-border-sm" role="status" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center text-muted py-4" style={{ fontSize: 13 }}>
            {emptyMessage ?? __("No records found")}
          </div>
        ) : (
          rows.map((row, idx) => (
            <div
              key={row[rowKey] ?? idx}
              className="pos-table-row pos-list-card"
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{ cursor: onRowClick ? "pointer" : "default", ...(rowStyle ? rowStyle(row) : null) }}
            >
              <div className="pos-list-card-title">{cell(primary, row)}</div>
              {shown.length > 0 && (
                <div className="pos-list-card-grid">
                  {shown.map((c) => (
                    <div key={c.key} className="pos-list-card-field">
                      <span className="pos-list-card-label">{tLabel(__, c.label)}</span>
                      <span className={c.align === "end" || c.align === "center" ? "num" : undefined}>{cell(c, row)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="pos-card" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div
        className="pos-table-head"
        style={{
          display: "grid",
          gridTemplateColumns,
          columnGap: 12,
          padding: "10px 16px",
          background: "var(--color-surface-alt)",
          borderBottom: "1px solid var(--color-border-soft)",
          flexShrink: 0,
        }}
      >
        {columns.map((c) => (
          <span key={c.key} style={{ textAlign: c.align }}>
            {tLabel(__, c.label)}
          </span>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {loading ? (
          <div className="text-center py-4">
            <span className="spinner-border spinner-border-sm" role="status" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center text-muted py-4" style={{ fontSize: 13 }}>
            {emptyMessage ?? __("No records found")}
          </div>
        ) : (
          rows.map((row, idx) => (
            <div
              key={row[rowKey] ?? idx}
              className="pos-table-row"
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{
                display: "grid",
                gridTemplateColumns,
                columnGap: 12,
                padding: "11px 16px",
                alignItems: "center",
                cursor: onRowClick ? "pointer" : "default",
                borderBottom: idx === rows.length - 1 ? "none" : "1px solid var(--color-border-faint)",
                ...(rowStyle ? rowStyle(row) : null),
              }}
            >
              {columns.map((c) => (
                <span
                  key={c.key}
                  className={c.align === "end" || c.align === "center" ? "num" : undefined}
                  style={{ textAlign: c.align, ...c.cellStyle }}
                >
                  {c.render ? c.render(row) : row[c.key]}
                </span>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ListTable;
