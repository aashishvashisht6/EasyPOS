import { useEffect, useState } from "react";
import "./style.css";
import { fetchClosingEntry, postClosingEntry } from "../../api/ClosingEntry";
import usePOSSessionStore from "../../store/posSessionStore";
import { CurrencyField, Modal } from "../common";

const ClosingModal = ({ onConfirm, onClose }) => {
  const [closingDetails, setClosingDetails] = useState([]);
  const [countedAmounts, setCountedAmounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const openingDetail = usePOSSessionStore((s) => s.openingDetail);
  const currencySymbol = usePOSSessionStore((s) => s.currencySymbol);
  const clearOpeningEntry = usePOSSessionStore((s) => s.clearOpeningEntry);

  const hasManualRows = closingDetails.some((row) => !row.automatically_calculated);

  useEffect(() => {
    fetchClosingEntry(openingDetail).then((data) => {
      const details = data?.details ?? [];
      setClosingDetails(details);
      setCountedAmounts(
        Object.fromEntries(details.map((row) => [row.mode_of_payment, row.closing_amount ?? 0])),
      );
      setLoading(false);
    });
  }, []);

  const formatAmount = (value) => `${currencySymbol}${(value ?? 0).toLocaleString("en-IN")}`;

  const handleConfirm = () => {
    setSubmitting(true);
    const closingData = {
      ...openingDetail,
      pos_opening_entry: openingDetail.name,
      closing_details: closingDetails.map((row) => ({
        ...row,
        closing_amount: countedAmounts[row.mode_of_payment] ?? row.closing_amount,
      })),
    };
    postClosingEntry(closingData).then((response) => {
      setSubmitting(false);
      if (response?.name) {
        clearOpeningEntry();
        onConfirm();
      }
    });
  };

  return (
    <Modal
      title="Close your till"
      subtitle={
        hasManualRows
          ? "Count the drawer and enter the actual amount for manually entered payment modes."
          : "Review the counted totals for this shift before closing."
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="pos-btn pos-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="pos-btn pos-btn-primary"
            onClick={handleConfirm}
            disabled={submitting || loading}
          >
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" />
                Closing…
              </>
            ) : (
              "Close till"
            )}
          </button>
        </>
      }
    >
      <div className="closing-entry-pill mb-3">
        <span className="closing-entry-pill-label">POS Opening Entry</span>
        <span className="closing-entry-pill-value">{openingDetail?.name}</span>
      </div>

      <label className="pos-field-label">Payment Summary</label>

      {loading ? (
        <div className="text-center py-4">
          <span className="spinner-border spinner-border-sm" role="status" />
        </div>
      ) : closingDetails.length === 0 ? (
        <div className="text-muted text-center py-3" style={{ fontSize: 13 }}>
          No payment modes found for this shift.
        </div>
      ) : (
        <div className="closing-rows">
          {closingDetails.map((row, idx) => {
            const editable = !row.automatically_calculated;
            const counted = countedAmounts[row.mode_of_payment] ?? row.closing_amount ?? 0;
            const diff = editable ? counted - (row.closing_amount ?? 0) : 0;
            return (
              <div className="closing-row" key={idx}>
                <div className="closing-row-title">{row.mode_of_payment}</div>
                <div className="closing-row-figures">
                  <div className="closing-figure">
                    <div className="closing-figure-label">Opening</div>
                    <div className="closing-figure-value">{formatAmount(row.opening_amount)}</div>
                  </div>

                  <div className="closing-figure">
                    <div className="closing-figure-label">
                      {editable ? "Expected" : "Closing"}
                    </div>
                    <div className="closing-figure-value">{formatAmount(row.closing_amount)}</div>
                  </div>

                  {editable ? (
                    <div className="closing-figure">
                      <div className="closing-figure-label">Counted</div>
                      <CurrencyField
                        className="mb-0"
                        value={counted}
                        min={0}
                        size="sm"
                        onChange={(value) =>
                          setCountedAmounts((prev) => ({
                            ...prev,
                            [row.mode_of_payment]: value === "" ? 0 : value,
                          }))
                        }
                      />
                    </div>
                  ) : (
                    <div className="closing-figure" />
                  )}

                  <div className="closing-figure">
                    <div className="closing-figure-label">Difference</div>
                    <div
                      className="closing-figure-value"
                      style={{
                        color: !editable
                          ? "var(--color-text-faint)"
                          : diff > 0
                          ? "var(--color-success-text)"
                          : diff < 0
                          ? "var(--color-danger-text)"
                          : "var(--color-text-secondary)",
                      }}
                    >
                      {editable ? `${diff > 0 ? "+" : ""}${formatAmount(diff)}` : "—"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export default ClosingModal;
