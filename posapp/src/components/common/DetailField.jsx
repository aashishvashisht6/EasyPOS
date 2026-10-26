import { tLabel, useTranslation } from "../../translation";

// Read-only label/value pair for FormView detail sections. The label is a
// small uppercase caption (.pos-detail-label) and the value sits in a
// filled, bordered box (.pos-detail-value) so the two are unambiguous at a
// glance, instead of two plain-text lines that read as similar weight.
// `label` renders through __(), so FormView blocks can pass _t("...") keys.
const DetailField = ({ label, value, mono, muted }) => {
  const { __ } = useTranslation();
  return (
    <div className="pos-field" style={{ marginBottom: 0 }}>
      {label && <label className="pos-detail-label">{tLabel(__, label)}</label>}
      <div className={`pos-detail-value${mono ? " mono" : ""}${muted ? " muted" : ""}`}>
        {value === undefined || value === null || value === "" ? (
          <span style={{ color: "var(--color-text-faint)" }}>—</span>
        ) : (
          value
        )}
      </div>
    </div>
  );
};

export default DetailField;
