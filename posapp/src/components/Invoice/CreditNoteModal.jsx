import { useEffect, useState } from "react";
import { Modal, ChildTable } from "../common";
import { createCreditNote } from "../../api/Invoice";
import { flt } from "../../utils/number";

// Item/tax rows are seeded from the original invoice on open and edited
// locally — nothing is written back until "Create Credit Note" is pressed.
const seedItemRows = (invoice) =>
  (invoice?.items ?? []).map((item, idx) => ({
    _idx: idx,
    item_code: item.item_code,
    item_name: item.item_name,
    uom: item.uom,
    rate: item.rate,
    origQty: item.qty,
    returnQty: item.qty,
    selected: true,
    warehouse: item.warehouse,
    income_account: item.income_account,
    cost_center: item.cost_center,
  }));

const seedTaxRows = (invoice) =>
  (invoice?.taxes ?? []).map((tax, idx) => ({
    _idx: idx,
    account_head: tax.account_head,
    charge_type: tax.charge_type,
    description: tax.description,
    cost_center: tax.cost_center,
    rate: tax.rate,
    tax_amount: tax.tax_amount,
  }));

const CreditNoteModal = ({ open, onClose, invoice, currencySymbol, onCreated }) => {
  const [itemRows, setItemRows] = useState([]);
  const [taxRows, setTaxRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setItemRows(seedItemRows(invoice));
      setTaxRows(seedTaxRows(invoice));
      setError("");
    }
  }, [open, invoice]);

  if (!open) return null;

  const money = (value) => `${currencySymbol}${(value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const updateItem = (idx, patch) => {
    setItemRows((rows) => rows.map((r) => (r._idx === idx ? { ...r, ...patch } : r)));
  };

  const updateTax = (idx, patch) => {
    setTaxRows((rows) => rows.map((r) => (r._idx === idx ? { ...r, ...patch } : r)));
  };

  const selectedItems = itemRows.filter((r) => r.selected && flt(r.returnQty) > 0);
  const returnTotal = selectedItems.reduce((sum, r) => sum + flt(r.returnQty) * flt(r.rate), 0);

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      setError("Select at least one item to return");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const creditNote = await createCreditNote(
        invoice.name,
        selectedItems.map((r) => ({
          item_code: r.item_code,
          item_name: r.item_name,
          uom: r.uom,
          rate: r.rate,
          qty: r.returnQty,
          warehouse: r.warehouse,
          income_account: r.income_account,
          cost_center: r.cost_center,
        })),
        taxRows.map((t) => ({
          account_head: t.account_head,
          charge_type: t.charge_type,
          description: t.description,
          cost_center: t.cost_center,
          rate: t.rate,
          tax_amount: t.tax_amount,
        })),
      );
      onCreated?.(creditNote);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.exc_type || "Failed to create credit note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Credit Note"
      subtitle={invoice?.name}
      size="xl"
      footer={
        <>
          <button type="button" className="pos-btn pos-btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="pos-btn pos-btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving && <span className="spinner-border spinner-border-sm" role="status" />}
            Create Credit Note
          </button>
        </>
      }
    >
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <h6 className="mb-2" style={{ fontSize: 13, fontWeight: 600 }}>
        Items to Return
      </h6>
      <div className="mb-4">
        <ChildTable
          rowKey="_idx"
          rows={itemRows}
          emptyMessage="No items on this invoice"
          columns={[
            {
              key: "selected",
              label: "",
              width: "0.4fr",
              render: (r) => (
                <input
                  type="checkbox"
                  className="form-check-input pos-checkbox"
                  checked={r.selected}
                  onChange={(e) => updateItem(r._idx, { selected: e.target.checked })}
                />
              ),
            },
            { key: "item_code", label: "Item", width: "1.8fr", render: (r) => r.item_name || r.item_code },
            { key: "origQty", label: "Invoiced Qty", width: "0.9fr", align: "center", render: (r) => r.origQty },
            {
              key: "returnQty",
              label: "Return Qty",
              width: "1fr",
              align: "center",
              render: (r) => (
                <input
                  type="number"
                  className="form-control form-control-sm"
                  style={{ maxWidth: 90 }}
                  min={0}
                  max={r.origQty}
                  step="any"
                  disabled={!r.selected}
                  value={r.returnQty}
                  onChange={(e) => updateItem(r._idx, { returnQty: e.target.value === "" ? "" : Number(e.target.value) })}
                />
              ),
            },
            { key: "rate", label: "Rate", width: "1fr", align: "end", render: (r) => money(r.rate) },
            {
              key: "amount",
              label: "Return Amount",
              width: "1fr",
              align: "end",
              render: (r) => money(flt(r.returnQty) * flt(r.rate)),
            },
          ]}
          footer={[
            null,
            null,
            null,
            null,
            { value: "Return Total", align: "end" },
            { value: money(returnTotal), align: "end" },
          ]}
        />
      </div>

      <h6 className="mb-2" style={{ fontSize: 13, fontWeight: 600 }}>
        Taxes and Charges
      </h6>
      <ChildTable
        rowKey="_idx"
        rows={taxRows}
        emptyMessage="No taxes on this invoice"
        columns={[
          { key: "account_head", label: "Account Head", width: "1.8fr" },
          { key: "charge_type", label: "Type", width: "1.4fr" },
          {
            key: "rate",
            label: "Rate (%)",
            width: "1fr",
            align: "end",
            render: (r) => (
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ maxWidth: 90 }}
                step="any"
                disabled={r.charge_type === "Actual"}
                value={r.rate ?? ""}
                onChange={(e) => updateTax(r._idx, { rate: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            ),
          },
          {
            key: "tax_amount",
            label: "Amount",
            width: "1fr",
            align: "end",
            render: (r) => (
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ maxWidth: 100 }}
                step="any"
                disabled={r.charge_type !== "Actual"}
                value={r.tax_amount ?? ""}
                onChange={(e) => updateTax(r._idx, { tax_amount: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            ),
          },
        ]}
      />
      <p className="text-muted mt-2 mb-0" style={{ fontSize: 11.5 }}>
        Rate (%) applies to percentage-based charges; Amount applies to "Actual" charges. Totals are recalculated
        against the returned items when the credit note is created.
      </p>
    </Modal>
  );
};

export default CreditNoteModal;
