// Grid-based list table for list-view pages (Invoices, Customers, etc).
// columns: [{ key, label, width (flex-basis for grid-template-columns, default "1fr"), render(row), align }]
const ListTable = ({
  columns,
  rows,
  rowKey = "name",
  loading = false,
  emptyMessage = "No records found",
  onRowClick,
  rowStyle,
}) => {
  const gridTemplateColumns = columns.map((c) => c.width || "1fr").join(" ");

  return (
    <div className="pos-card" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns,
          padding: "10px 16px",
          background: "var(--color-surface-alt)",
          borderBottom: "1px solid var(--color-border-soft)",
          flexShrink: 0,
        }}
      >
        {columns.map((c) => (
          <span
            key={c.key}
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--color-text-faint)",
              textAlign: c.align,
            }}
          >
            {c.label}
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
            {emptyMessage}
          </div>
        ) : (
          rows.map((row, idx) => (
            <div
              key={row[rowKey] ?? idx}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{
                display: "grid",
                gridTemplateColumns,
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
                  style={{
                    fontSize: 12.5,
                    color: "var(--color-text-primary)",
                    textAlign: c.align,
                    ...c.cellStyle,
                  }}
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
