// Read-only grid for a child doctype table inside a FormView detail section
// (e.g. Sales Invoice Item / Sales Invoice Payment rows). Same column-def
// shape as ListTable (key, label, width, align, render) but embedded (no
// pos-card wrapper of its own) and with an optional totals footer row.
// footer: array aligned to `columns`, each entry `{ value, align }` or null.
//
// Tables with many columns (e.g. Items) would otherwise squash unreadably on
// tablet widths — the grid gets a min-width floor and the outer wrapper
// scrolls horizontally instead, per the project's "wide content scrolls in
// its own container" convention. Header/row/footer typography lives in
// components.css (.pos-child-table-*) — zebra striping + hover on rows,
// uppercase caption headers, and monospaced right-aligned (numeric) cells
// so amounts line up like a real ledger instead of plain ragged text.
const ChildTable = ({ columns, rows = [], rowKey = "name", emptyMessage = "No rows", footer }) => {
  const gridTemplateColumns = columns.map((c) => c.width || "1fr").join(" ");
  const minWidth = Math.max(columns.length * 110, 480);

  return (
    <div
      style={{
        border: "1px solid var(--color-border-soft)",
        borderRadius: "var(--radius-md)",
        overflowX: "auto",
      }}
    >
      <div style={{ minWidth }}>
        <div
          className="pos-table-head"
          style={{
            display: "grid",
            gridTemplateColumns,
            columnGap: 12,
            padding: "9px 14px",
            background: "var(--color-surface-alt)",
            borderBottom: "1px solid var(--color-border-soft)",
          }}
        >
          {columns.map((c) => (
            <span key={c.key} style={{ textAlign: c.align }}>
              {c.label}
            </span>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="text-center text-muted py-4" style={{ fontSize: 12.5 }}>
            {emptyMessage}
          </div>
        ) : (
          rows.map((row, idx) => (
            <div
              key={row[rowKey] ?? idx}
              className="pos-table-row"
              style={{
                display: "grid",
                gridTemplateColumns,
                columnGap: 12,
                padding: "10px 14px",
                alignItems: "center",
                borderBottom: idx === rows.length - 1 && !footer ? "none" : "1px solid var(--color-border-faint)",
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

        {footer && (
          <div
            className="pos-table-footer"
            style={{
              display: "grid",
              gridTemplateColumns,
              columnGap: 12,
              padding: "10px 14px",
              background: "var(--color-surface-alt)",
              borderTop: "1px solid var(--color-border-soft)",
            }}
          >
            {footer.map((cell, idx) => (
              <span key={idx} className={cell?.align === "end" ? "num" : undefined} style={{ textAlign: cell?.align }}>
                {cell?.value}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChildTable;
