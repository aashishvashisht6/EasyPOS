import { useEffect, useRef, useState } from "react";

// Grid for a child doctype table, shared by both read-only detail views
// (FormView sections, e.g. Sales Invoice Item / Payment rows) and editable
// child-table editors (POS Profile's payments/users/item groups, Price
// List's countries, ...). Same column-def shape as ListTable (key, label,
// width, align, render(row, idx), cellStyle) plus an optional totals footer
// row. footer: array aligned to `columns`, each entry `{ value, align }` or
// null.
//
// Read-only vs. editable isn't a mode flag — it's just what `render` returns.
// A column can render plain text (read-only) or a Field component wired to
// onChange(idx) (editable); ChildTable itself only lays rows out. `render`
// receives (row, idx) so editable callers can address the row being edited.
//
// title/description/onAddRow are optional and only matter for standalone
// editable usage outside FormView (which renders its own block title): when
// passed, ChildTable renders the "<title> ... + Add row" header and helper
// text itself, so callers don't have to hand-roll that boilerplate per page.
// addRowPosition="bottom" renders that same action as a dashed strip living
// under the table instead, useful once a table has enough rows that a
// header button scrolls out of view.
//
// Optional enhancements (all opt-in, no effect on existing callers that
// don't pass them):
// - loading: shows shimmer skeleton rows instead of `rows`.
// - emptyDescription: a second, smaller line under `emptyMessage`.
// - renderExpanded(row, idx): when set, every row gets a chevron toggle
//   that reveals this content inline (e.g. a Product Bundle's packed
//   components) — expand/collapse state lives entirely inside ChildTable.
// - rowError(row, idx): return a message to highlight that row (danger
//   left-border) and show the message on a strip below it — e.g. flagging
//   a duplicate Mode of Payment row in an editable table.
// - onMoveRow(idx, "up" | "down"): when set, adds up/down reorder buttons
//   per row; ChildTable never reorders `rows` itself, it just reports intent.
//
// Tables with many columns (e.g. Items) would otherwise squash unreadably on
// tablet widths — the grid gets a min-width floor and the outer wrapper
// scrolls horizontally instead, per the project's "wide content scrolls in
// its own container" convention (a right-edge fade hints there's more to
// scroll). Header/row/footer typography lives in components.css
// (.pos-table-*) — zebra striping + hover on rows, uppercase caption
// headers, monospaced right-aligned (numeric) cells, and an accented footer
// so a totals row reads as a summary rather than just another line.
const ChildTable = ({
  columns,
  rows = [],
  rowKey = "name",
  emptyMessage = "No rows",
  emptyDescription,
  footer,
  title,
  description,
  onAddRow,
  addRowLabel = "+ Add row",
  addRowPosition = "top",
  loading = false,
  renderExpanded,
  rowError,
  onMoveRow,
}) => {
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());
  const scrollRef = useRef(null);
  const [showRightFade, setShowRightFade] = useState(false);

  const expandable = typeof renderExpanded === "function";
  const gridColumnsList = [
    ...(expandable ? ["24px"] : []),
    ...columns.map((c) => c.width || "1fr"),
    ...(onMoveRow ? ["52px"] : []),
  ];
  const gridTemplateColumns = gridColumnsList.join(" ");
  const minWidth = Math.max(gridColumnsList.length * 110, 480);

  const toggleExpanded = (key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const updateFade = () => setShowRightFade(el.scrollWidth - el.scrollLeft - el.clientWidth > 4);
    updateFade();
    el.addEventListener("scroll", updateFade);
    window.addEventListener("resize", updateFade);
    return () => {
      el.removeEventListener("scroll", updateFade);
      window.removeEventListener("resize", updateFade);
    };
  }, [rows, loading, columns]);

  return (
    <div>
      {(title || (onAddRow && addRowPosition === "top")) && (
        <div className="d-flex justify-content-between align-items-center mb-3">
          {title && (
            <h6 className="mb-0" style={{ fontSize: 13, fontWeight: 600 }}>
              {title}
            </h6>
          )}
          {onAddRow && addRowPosition === "top" && (
            <button
              type="button"
              className="pos-btn pos-btn-secondary"
              style={{ height: 30, fontSize: 12, padding: "0 12px" }}
              onClick={onAddRow}
            >
              {addRowLabel}
            </button>
          )}
        </div>
      )}
      {description && (
        <p className="text-muted mb-3" style={{ fontSize: 12 }}>
          {description}
        </p>
      )}

      <div className="pos-ct-wrap" style={{ position: "relative", border: "1px solid var(--color-border-soft)", borderRadius: "var(--radius-md)" }}>
        <div className="pos-ct-scroll" ref={scrollRef} style={{ overflowX: "auto" }}>
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
              {expandable && <span />}
              {columns.map((c) => (
                <span key={c.key} style={{ textAlign: c.align }}>
                  {c.label}
                </span>
              ))}
              {onMoveRow && <span />}
            </div>

            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns,
                    columnGap: 12,
                    padding: "11px 14px",
                    alignItems: "center",
                    borderBottom: "1px solid var(--color-border-faint)",
                  }}
                >
                  {gridColumnsList.map((_, ci) => (
                    <span key={ci} className="pos-ct-skel" style={{ height: 11, width: ci === 0 ? "36%" : "72%" }} />
                  ))}
                </div>
              ))
            ) : rows.length === 0 ? (
              <div className="pos-ct-empty">
                <div className="pos-ct-empty-icon">
                  <i className="bi bi-inbox" />
                </div>
                <div className="pos-ct-empty-title">{emptyMessage}</div>
                {emptyDescription && <div className="pos-ct-empty-desc">{emptyDescription}</div>}
              </div>
            ) : (
              rows.map((row, idx) => {
                const key = row[rowKey] ?? idx;
                const isOpen = expandable && expandedKeys.has(key);
                const errorMsg = rowError ? rowError(row, idx) : null;
                const isLast = idx === rows.length - 1;

                return (
                  <div key={key}>
                    <div
                      className="pos-table-row"
                      style={{
                        display: "grid",
                        gridTemplateColumns,
                        columnGap: 12,
                        padding: "10px 14px",
                        // "start", not "center" — several columns can carry a wrapped
                        // helper line under a field (e.g. the payments editor's
                        // "Automatically Calculated"/"Payment Gateway" descriptions),
                        // so centering against the row's tallest cell shoves short
                        // single-line cells and the expand/move icon buttons to an
                        // inconsistent vertical spot. Top-aligning keeps every cell
                        // anchored to the same baseline regardless of a sibling's height.
                        alignItems: "start",
                        borderLeft: errorMsg ? "2px solid var(--color-danger-text)" : "2px solid transparent",
                        borderBottom: isLast && !footer && !isOpen && !errorMsg ? "none" : "1px solid var(--color-border-faint)",
                      }}
                    >
                      {expandable && (
                        <button
                          type="button"
                          className={`pos-ct-expand-btn${isOpen ? " open" : ""}`}
                          onClick={() => toggleExpanded(key)}
                          title={isOpen ? "Collapse" : "Expand"}
                        >
                          <i className="bi bi-chevron-right" />
                        </button>
                      )}
                      {columns.map((c) => (
                        <span
                          key={c.key}
                          className={c.align === "end" || c.align === "center" ? "num" : undefined}
                          style={{ textAlign: c.align, ...c.cellStyle }}
                        >
                          {c.render ? c.render(row, idx) : row[c.key]}
                        </span>
                      ))}
                      {onMoveRow && (
                        <span className="pos-ct-move">
                          <button
                            type="button"
                            className="pos-btn-icon"
                            disabled={idx === 0}
                            onClick={() => onMoveRow(idx, "up")}
                            title="Move up"
                          >
                            <i className="bi bi-chevron-up" />
                          </button>
                          <button
                            type="button"
                            className="pos-btn-icon"
                            disabled={isLast}
                            onClick={() => onMoveRow(idx, "down")}
                            title="Move down"
                          >
                            <i className="bi bi-chevron-down" />
                          </button>
                        </span>
                      )}
                    </div>
                    {isOpen && <div className="pos-ct-expand-panel">{renderExpanded(row, idx)}</div>}
                    {errorMsg && (
                      <div className="pos-ct-row-error">
                        <i className="bi bi-exclamation-circle" />
                        {errorMsg}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {footer && (
              <div
                className="pos-table-footer pos-ct-footer"
                style={{
                  display: "grid",
                  gridTemplateColumns,
                  columnGap: 12,
                  padding: "10px 14px",
                }}
              >
                {expandable && <span />}
                {footer.map((cell, idx) => (
                  <span key={idx} className={cell?.align === "end" ? "num" : undefined} style={{ textAlign: cell?.align }}>
                    {cell?.value}
                  </span>
                ))}
                {onMoveRow && <span />}
              </div>
            )}
          </div>
        </div>
        <div className={`pos-ct-fade-right${showRightFade ? " show" : ""}`} />
      </div>

      {onAddRow && addRowPosition === "bottom" && (
        <button type="button" className="pos-ct-add-strip" onClick={onAddRow}>
          <i className="bi bi-plus-lg" />
          {addRowLabel.replace(/^\+\s*/, "")}
        </button>
      )}
    </div>
  );
};

export default ChildTable;
