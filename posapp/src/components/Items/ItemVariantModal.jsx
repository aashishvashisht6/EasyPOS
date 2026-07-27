import { useEffect, useMemo, useState } from "react";
import { fetchItemVariants } from "../../api/Items";
import { Modal, ErrorAlert } from "../common";
import usePOSSessionStore from "../../store/posSessionStore";
import useCartStore from "../../store/cartStore";

// Attribute-chip picker for a variant template item — narrows `attributes`
// down to the single matching variant, disabling any value that would leave
// zero variants matching alongside what's already selected (same intent as
// ERPNext desk's own variant selector).
const ItemVariantModal = ({ templateItem, onClose, onAdd }) => {
  const [attributes, setAttributes] = useState([]);
  const [variants, setVariants] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);

  const warehouse = usePOSSessionStore((s) => s.warehouse);
  const priceList = usePOSSessionStore((s) => s.priceList);
  const currencySymbol = usePOSSessionStore((s) => s.currencySymbol);
  const customer = useCartStore((s) => s.customer);

  useEffect(() => {
    setLoading(true);
    setError("");
    setSelected({});
    setQty(1);
    fetchItemVariants(templateItem.item_code, warehouse, priceList, customer).then((data) => {
      if (!data || !data.variants?.length) {
        setError("No variants are set up for this item yet.");
        setLoading(false);
        return;
      }
      setAttributes(data.attributes);
      setVariants(data.variants);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateItem.item_code]);

  // Variants still consistent with the current selection, per attribute
  // excluded one at a time — lets us tell, for each unselected chip, whether
  // choosing it would still leave at least one matching variant.
  const matchesExcept = (excludeAttr) => (variant) =>
    Object.entries(selected).every(
      ([attr, value]) => attr === excludeAttr || variant.attributes?.[attr] === value,
    );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fullyMatching = useMemo(() => variants.filter(matchesExcept(null)), [variants, selected]);
  const resolvedVariant = fullyMatching.length === 1 ? fullyMatching[0] : null;

  const handlePick = (attribute, value) => {
    setSelected((prev) => {
      if (prev[attribute] === value) {
        const next = { ...prev };
        delete next[attribute];
        return next;
      }
      return { ...prev, [attribute]: value };
    });
  };

  const hasStock = resolvedVariant && resolvedVariant.stock !== null && resolvedVariant.stock !== undefined;
  const outOfStock = hasStock && resolvedVariant.stock <= 0;

  const handleAdd = () => {
    if (!resolvedVariant || outOfStock) return;
    onAdd(resolvedVariant, qty);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={templateItem.item_name || templateItem.item_code}
      subtitle="Choose options to select a variant"
      footer={
        <>
          <button type="button" className="pos-btn pos-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="pos-btn pos-btn-primary"
            disabled={!resolvedVariant || outOfStock}
            onClick={handleAdd}
          >
            Add to Cart
          </button>
        </>
      }
    >
      <ErrorAlert message={error} />
      {loading ? (
        <div className="d-flex align-items-center justify-content-center text-muted py-4">
          <i className="bi bi-arrow-repeat me-2" /> Loading variants…
        </div>
      ) : (
        !error && (
          <div className="d-flex flex-column gap-3">
            {attributes.map(({ attribute, values }) => (
              <div key={attribute}>
                <div className="pos-detail-label mb-2">{attribute}</div>
                <div className="d-flex flex-wrap gap-2">
                  {values.map((value) => {
                    const isSelected = selected[attribute] === value;
                    const isViable = variants.some(
                      (v) => v.attributes?.[attribute] === value && matchesExcept(attribute)(v),
                    );
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`pos-variant-chip ${isSelected ? "selected" : ""}`}
                        disabled={!isViable}
                        onClick={() => handlePick(attribute, value)}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="pos-variant-summary">
              {resolvedVariant ? (
                <>
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-muted)" }}>
                        {resolvedVariant.item_code}
                      </div>
                      <div className="fw-semibold">
                        {resolvedVariant.rate === null || resolvedVariant.rate === undefined
                          ? "—"
                          : `${currencySymbol}${resolvedVariant.rate}`}
                      </div>
                    </div>
                    <div className="pos-item-stepper" style={{ marginTop: 0 }}>
                      <button type="button" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>
                        −
                      </button>
                      <span>{qty}</span>
                      <button type="button" onClick={() => setQty((q) => q + 1)}>
                        +
                      </button>
                    </div>
                  </div>
                  {outOfStock && (
                    <div className="text-danger mt-2" style={{ fontSize: 12 }}>
                      Out of stock
                    </div>
                  )}
                </>
              ) : (
                <span className="text-muted" style={{ fontSize: 13 }}>
                  Select an option for every attribute to pick a variant.
                </span>
              )}
            </div>
          </div>
        )
      )}
    </Modal>
  );
};

export default ItemVariantModal;
