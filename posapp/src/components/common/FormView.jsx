import DetailField from "./DetailField";
import ChildTable from "./ChildTable";
import PageLoader from "./PageLoader";
import PageHeader from "./PageHeader";

// Generic read-only document detail page: a header (back link, title, badge,
// actions) followed by an ordered list of blocks. Doctype pages
// (InvoiceDetailPage, ...) supply the data and control the order (e.g. a
// child table can sit between two field sections); this component only
// knows how to lay each block out consistently with the rest of the theme.
//
// blocks: [
//   { type: "fields", title, fields: [{ label, value, mono, muted, span (col-md-*, default 3) }] },
//   { type: "table", title, columns, rows, rowKey, emptyMessage, footer },
// ]
const FormView = ({ title, subtitle, badge, backTo, backLabel = "Back", actions, blocks = [], loading }) => {
  if (loading) return <PageLoader />;

  return (
    <div className="px-3 px-md-4 py-3 py-md-4">
      <PageHeader title={title} subtitle={subtitle} badge={badge} backTo={backTo} backLabel={backLabel} actions={actions} />

      {blocks.map((block, i) => (
        <div className="pos-card mb-3 p-3 p-md-4" key={`${block.type}-${block.title || i}`}>
          {block.title && (
            <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
              {block.title}
            </h6>
          )}
          {block.type === "table" ? (
            <ChildTable
              columns={block.columns}
              rows={block.rows}
              rowKey={block.rowKey}
              emptyMessage={block.emptyMessage}
              footer={block.footer}
            />
          ) : (
            <div className="row g-3">
              {block.fields.map((f, idx) => (
                <div className={`col-6 col-md-4 col-lg-${f.span || 3}`} key={idx}>
                  <DetailField {...f} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FormView;
