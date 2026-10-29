import { useEffect, useState } from "react";
import { createCashMovement, fetchCashMovements } from "../../api/CashMovement";
import usePOSSessionStore from "../../store/posSessionStore";
import {
  Modal,
  FilterChips,
  SelectField,
  CurrencyField,
  TextField,
  ErrorAlert,
  SaveButton,
} from "../common";
import "./style.css";

const MOVEMENT_TYPES = [
  { label: "Cash Out", value: "Cash Out" },
  { label: "Cash In", value: "Cash In" },
];

const EMPTY_FORM = { movementType: "Cash Out", mode: "", amount: "", reason: "", approver: "", password: "" };

// Mid-shift Cash In / Cash Out (UPCOMING_FEATURES.md #16) — cash added to or
// pulled from the drawer outside of a sale (a bank drop, petty cash, a change
// top-up), recorded as an EP Cash Movement against the open shift so
// get_closing_entry nets it into the expected amount at close-out.
// A cashier without the POS Cash Manager role needs a manager's username and
// password here — checked server-side by easy_pos.api.cash_movement.create_cash_movement.
const CashMovementModal = ({ onClose }) => {
  const openingDetail = usePOSSessionStore((s) => s.openingDetail);
  const currencySymbol = usePOSSessionStore((s) => s.currencySymbol);
  const currencyPrecision = usePOSSessionStore((s) => s.currencyPrecision);

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [recorded, setRecorded] = useState("");

  const formatAmount = (value) =>
    `${currencySymbol}${(value ?? 0).toLocaleString("en-IN", {
      minimumFractionDigits: currencyPrecision,
      maximumFractionDigits: currencyPrecision,
    })}`;

  const load = () =>
    fetchCashMovements(openingDetail.name)
      .then((result) => {
        setData(result);
        setForm((prev) => ({ ...prev, mode: prev.mode || result.cash_modes[0] || "" }));
      })
      .catch((err) => setLoadError(err.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingDetail.name]);

  const update = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  const needsApproval = data && !data.can_record;

  const handleSubmit = () => {
    setError("");
    setRecorded("");
    const amount = parseFloat(form.amount) || 0;
    if (amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!form.reason.trim()) {
      setError("Enter a reason — it's kept on the shift's record.");
      return;
    }
    if (needsApproval && (!form.approver.trim() || !form.password)) {
      setError("A POS Cash Manager needs to approve this — enter their username and password.");
      return;
    }
    setSaving(true);
    createCashMovement({
      opening_entry: openingDetail.name,
      movement_type: form.movementType,
      mode_of_payment: form.mode,
      amount,
      reason: form.reason.trim(),
      approver: needsApproval ? form.approver.trim() : undefined,
      approver_password: needsApproval ? form.password : undefined,
    })
      .then((doc) => {
        setRecorded(`${doc.movement_type} of ${formatAmount(doc.amount)} recorded.`);
        // The manager's password is never kept around after use, on success or failure.
        setForm((prev) => ({ ...EMPTY_FORM, movementType: prev.movementType, mode: prev.mode }));
        load();
      })
      .catch((err) => {
        setForm((prev) => ({ ...prev, password: "" }));
        setError(err.message);
      })
      .finally(() => setSaving(false));
  };

  const movements = data?.movements ?? [];
  const totalIn = movements.filter((m) => m.movement_type === "Cash In").reduce((sum, m) => sum + m.amount, 0);
  const totalOut = movements.filter((m) => m.movement_type === "Cash Out").reduce((sum, m) => sum + m.amount, 0);
  const noCashModes = data && data.cash_modes.length === 0;

  return (
    <Modal
      title="Cash In / Out"
      subtitle="Record cash added to or taken out of the drawer outside of a sale."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="pos-btn pos-btn-secondary" onClick={onClose}>
            Close
          </button>
          <SaveButton
            saving={saving}
            onClick={handleSubmit}
            label={`Record ${form.movementType}`}
            savingLabel="Recording…"
            disabled={!data || noCashModes}
          />
        </>
      }
    >
      <ErrorAlert message={loadError || error} />
      {recorded && (
        <div className="cash-movement-success mb-3">
          <i className="bi bi-check-circle-fill me-2" />
          {recorded}
        </div>
      )}

      {!data && !loadError ? (
        <div className="text-center py-4">
          <span className="spinner-border spinner-border-sm" role="status" />
        </div>
      ) : noCashModes ? (
        <div className="text-muted text-center py-3" style={{ fontSize: 13 }}>
          This POS Profile has no payment mode of type Cash, so there's no drawer to move cash in or out of.
        </div>
      ) : (
        data && (
          <>
            <div className="mb-3">
              <FilterChips options={MOVEMENT_TYPES} value={form.movementType} onChange={update("movementType")} />
            </div>

            <div className="cash-movement-grid">
              {data.cash_modes.length > 1 && (
                <SelectField
                  label="Mode of Payment"
                  value={form.mode}
                  onChange={update("mode")}
                  options={data.cash_modes}
                />
              )}
              <CurrencyField label="Amount" required min={0} value={form.amount} onChange={update("amount")} />
            </div>
            <TextField
              label="Reason"
              required
              placeholder={form.movementType === "Cash Out" ? "e.g. Bank deposit, petty cash for supplies" : "e.g. Change top-up"}
              value={form.reason}
              onChange={update("reason")}
            />

            {needsApproval && (
              <div className="cash-movement-approval">
                <div className="cash-movement-approval-title">
                  <i className="bi bi-shield-lock me-1" />
                  Manager approval
                </div>
                <div className="cash-movement-grid">
                  <TextField
                    label="Manager username"
                    autoComplete="off"
                    value={form.approver}
                    onChange={update("approver")}
                  />
                  <TextField
                    label="Password"
                    type="password"
                    // Shared till: never let the browser offer to save a manager's password here.
                    autoComplete="new-password"
                    value={form.password}
                    onChange={update("password")}
                  />
                </div>
              </div>
            )}

            <label className="pos-field-label mt-2">This shift</label>
            {movements.length === 0 ? (
              <div className="text-muted py-2" style={{ fontSize: 12.5 }}>
                No cash movements yet.
              </div>
            ) : (
              <>
                <div className="cash-movement-list">
                  {movements.map((m) => (
                    <div key={m.name} className="cash-movement-row">
                      <div className="cash-movement-row-main">
                        <span className={`pos-badge ${m.movement_type === "Cash In" ? "pos-badge-success" : "pos-badge-warning"}`}>
                          {m.movement_type}
                        </span>
                        <span className="cash-movement-reason" title={m.reason}>
                          {m.reason}
                        </span>
                      </div>
                      <div className="cash-movement-row-meta">
                        {new Date(m.posting_datetime.replace(" ", "T")).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {m.approved_by && m.approved_by !== m.user && ` · approved by ${m.approved_by}`}
                      </div>
                      <div className="cash-movement-amount">
                        {m.movement_type === "Cash In" ? "+" : "−"}
                        {formatAmount(m.amount)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cash-movement-totals">
                  <span>In {formatAmount(totalIn)}</span>
                  <span>Out {formatAmount(totalOut)}</span>
                  <span>
                    Net {totalIn - totalOut < 0 ? "−" : "+"}
                    {formatAmount(Math.abs(totalIn - totalOut))}
                  </span>
                </div>
              </>
            )}
          </>
        )
      )}
    </Modal>
  );
};

export default CashMovementModal;
