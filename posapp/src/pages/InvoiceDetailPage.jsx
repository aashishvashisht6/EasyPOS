import { useEffect, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { fetchInvoice, cancelInvoice } from "../api/Invoice";
import { getPendingInvoices, retryOfflineInvoice } from "../engine/outbox";
import usePOSSessionStore from "../store/posSessionStore";
import { FormView, ConfirmModal, ErrorAlert } from "../components/common";
import CreditNoteModal from "../components/Invoice/CreditNoteModal";
import { formatDate, invoiceStatusBadgeClass } from "../utils/format";
import useEngineSettingsStore from "../engine/settingsStore";
import useConnectivityStore from "../engine/connectivity";

// Cashier-facing IDs minted by engine/outbox.js for an invoice queued offline
// (see queueOfflineInvoice's genDisplayId) — never a real ERPNext Sales
// Invoice name, so this route param needs a different (local-only) lookup.
const isOfflineDisplayId = (value) => typeof value === "string" && value.startsWith("OFFLINE-");

// item_tax_rate is stored as a JSON string, e.g. {"VAT - C": 18.0} — render it
// as a compact "name @ rate%" list instead of the raw blob.
const formatItemTaxRate = (value) => {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value);
    return Object.entries(parsed)
      .map(([name, rate]) => `${name} @ ${rate}%`)
      .join(", ");
  } catch {
    return "";
  }
};

const InvoiceDetailPage = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const { setTopbar } = useOutletContext();
  const currencySymbol = usePOSSessionStore((s) => s.currencySymbol);

  const [invoice, setInvoice] = useState(null);
  const [loadedName, setLoadedName] = useState(null);
  const loading = loadedName !== name;

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const [creditNoteOpen, setCreditNoteOpen] = useState(false);

  const offlineModeEnabled = useEngineSettingsStore((s) => s.offlineModeEnabled);
  const isOnline = useConnectivityStore((s) => s.isOnline);

  const [pendingRow, setPendingRow] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  const loadInvoice = () => {
    if (isOfflineDisplayId(name)) {
      getPendingInvoices().then((rows) => {
        const row = rows.find((r) => r.display_id === name) ?? null;
        // Already synced by the time it's opened (e.g. a background push
        // finished right before navigation) — jump straight to the real
        // invoice instead of showing a stale "pending" view for it.
        if (row?.status === "synced" && row.erpnext_name) {
          navigate(`/posapp/invoices/${encodeURIComponent(row.erpnext_name)}`, { replace: true });
          return;
        }
        setPendingRow(row);
        setInvoice(null);
        setLoadedName(name);
      });
      return;
    }
    setPendingRow(null);
    fetchInvoice(name).then((data) => {
      setInvoice(data ?? null);
      setLoadedName(name);
    });
  };

  useEffect(() => {
    loadInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const handleRetrySync = async () => {
    if (!pendingRow) return;
    setRetrying(true);
    setRetryError("");
    const result = await retryOfflineInvoice(pendingRow.offline_id);
    setRetrying(false);
    if (result?.ok) {
      navigate(`/posapp/invoices/${encodeURIComponent(result.name)}`, { replace: true });
    } else {
      setRetryError(result?.error || "Sync failed — check the Sync page for details.");
      loadInvoice();
    }
  };

  useEffect(() => {
    setTopbar({ title: invoice?.name || pendingRow?.display_id || "Invoice" });
  }, [invoice, pendingRow, setTopbar]);

  const money = (value) => `${currencySymbol}${(value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const openPrintView = () => {
    window.open(`/printview?doctype=Sales%20Invoice&name=${encodeURIComponent(name)}`, "_blank");
  };

  const handleCancel = async () => {
    setCancelError("");
    setCancelling(true);
    try {
      await cancelInvoice(invoice.name);
      setCancelOpen(false);
      loadInvoice();
    } catch (err) {
      setCancelError(err?.response?.data?.exc_type || "Failed to cancel invoice");
    } finally {
      setCancelling(false);
    }
  };

  const handleCreditNoteCreated = (creditNote) => {
    navigate(`/posapp/invoices/${encodeURIComponent(creditNote.name)}`);
  };

  if (isOfflineDisplayId(name)) {
    if (loading) {
      return <div className="px-4 py-5 text-center text-muted" style={{ fontSize: 13 }}>Loading…</div>;
    }
    if (!pendingRow) {
      return (
        <div className="px-4 py-5 text-center text-muted" style={{ fontSize: 13 }}>
          This offline sale isn't in the local queue on this device anymore.
        </div>
      );
    }
    const rows = pendingRow.payload?.invoice?.items ?? [];
    const total = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    return (
      <div className="px-4 py-4" style={{ maxWidth: 640 }}>
        <div className="d-flex align-items-center gap-2 mb-3">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 600 }}>{pendingRow.display_id}</span>
          <span
            className={`badge ${pendingRow.status === "failed" ? "bg-danger-subtle text-danger" : "bg-warning-subtle text-warning-emphasis"}`}
          >
            {pendingRow.status === "failed" ? "Sync failed" : pendingRow.status === "syncing" ? "Syncing…" : "Pending sync"}
          </span>
        </div>
        <div className="pos-card mb-3" style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--color-text-muted)" }}>
          <i className="bi bi-cloud-slash me-2" />
          This sale was completed offline and hasn't reached ERPNext yet. It will get a real invoice number once it
          syncs — reconnect and it should sync automatically, or retry below.
        </div>
        <ErrorAlert message={retryError} />
        <div className="pos-card mb-3" style={{ padding: "16px" }}>
          <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginBottom: 8 }}>ITEMS</div>
          {rows.map((r, i) => (
            <div key={i} className="d-flex justify-content-between" style={{ fontSize: 13, padding: "4px 0" }}>
              <span>{r.item_code} × {r.qty}</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{money(r.amount)}</span>
            </div>
          ))}
          <div className="d-flex justify-content-between" style={{ fontSize: 13, fontWeight: 600, borderTop: "1px solid var(--color-border-soft)", marginTop: 8, paddingTop: 8 }}>
            <span>Total</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>{money(total)}</span>
          </div>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="pos-btn pos-btn-secondary" onClick={() => navigate("/posapp/invoices")}>
            Back to Invoices
          </button>
          <button type="button" className="pos-btn pos-btn-primary" onClick={handleRetrySync} disabled={retrying || !isOnline}>
            {retrying ? (
              <><span className="spinner-border spinner-border-sm" role="status" /> Syncing…</>
            ) : (
              <><i className="bi bi-arrow-repeat" style={{ fontSize: 14 }} /> Retry sync</>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (!loading && !invoice) {
    // The Invoices list is browsable offline (its summary columns are
    // cached), but the full doc a detail view needs (items, taxes, payments)
    // isn't — see engine/localReads.js's readInvoiceList comment. Without this
    // check, a cashier tapping into a real invoice while offline sees "not
    // found", which reads as data loss rather than a connectivity limit.
    const offlineUnavailable = offlineModeEnabled && !isOnline;
    return (
      <div className="px-4 py-5 text-center text-muted" style={{ fontSize: 13 }}>
        {offlineUnavailable ? "Invoice details aren't available offline. Reconnect and try again." : "Invoice not found."}
      </div>
    );
  }

  const canCancel = invoice?.docstatus === 1;
  const canReturn = invoice?.docstatus === 1 && !invoice?.is_return;

  return (
    <>
      <FormView
        loading={loading}
        backTo="/posapp/invoices"
        backLabel="Invoices"
        title={invoice?.name}
        subtitle={invoice?.pos_profile}
        badge={invoice && <span className={invoiceStatusBadgeClass(invoice.status)}>{invoice.status}</span>}
        actions={
          <>
            {canReturn && (
              <button type="button" className="pos-btn pos-btn-secondary" onClick={() => setCreditNoteOpen(true)}>
                <i className="bi bi-arrow-return-left" style={{ fontSize: 14 }} /> Create Credit Note
              </button>
            )}
            {canCancel && (
              <button type="button" className="pos-btn pos-btn-danger" onClick={() => setCancelOpen(true)}>
                <i className="bi bi-x-circle" style={{ fontSize: 14 }} /> Cancel Invoice
              </button>
            )}
            <button type="button" className="pos-btn pos-btn-primary" onClick={openPrintView}>
              <i className="bi bi-printer" style={{ fontSize: 14 }} /> Print / Reprint
            </button>
          </>
        }
        blocks={
          invoice && [
            {
              type: "fields",
              title: "Invoice Details",
              fields: [
                { label: "Customer", value: invoice.customer_name || invoice.customer },
                { label: "Posting Date", value: formatDate(invoice.posting_date) },
                { label: "Posting Time", value: invoice.posting_time, mono: true },
                { label: "POS Profile", value: invoice.pos_profile },
                { label: "POS Opening Entry", value: invoice.custom_ep_opening_entry, mono: true },
                { label: "Currency", value: invoice.currency },
                { label: "Price List", value: invoice.selling_price_list },
                { label: "Warehouse", value: invoice.set_warehouse },
                ...(invoice.is_return
                  ? [{ label: "Return Against", value: invoice.return_against, mono: true }]
                  : []),
                { label: "Grand Total", value: money(invoice.grand_total), mono: true },
                { label: "Paid Amount", value: money(invoice.paid_amount), mono: true },
                {
                  label: "Outstanding Amount",
                  value: money(invoice.outstanding_amount),
                  mono: true,
                  muted: !invoice.outstanding_amount,
                },
              ],
            },
            {
              type: "table",
              title: "Items",
              columns: [
                { key: "item_code", label: "Item", width: "1.6fr" },
                { key: "qty", label: "Qty", width: "0.6fr", align: "center" },
                { key: "uom", label: "UOM", width: "0.7fr" },
                {
                  key: "rate",
                  label: "Rate",
                  width: "0.9fr",
                  align: "end",
                  render: (r) => money(r.rate),
                },
                {
                  key: "discount_percentage",
                  label: "Discount %",
                  width: "0.8fr",
                  align: "end",
                  render: (r) => (r.discount_percentage ? `${r.discount_percentage}%` : "—"),
                },
                {
                  key: "discount_amount",
                  label: "Discount Amt",
                  width: "0.9fr",
                  align: "end",
                  render: (r) => (r.discount_amount ? money(r.discount_amount) : "—"),
                },
                {
                  key: "item_tax_rate",
                  label: "Item Tax",
                  width: "1.3fr",
                  render: (r) => formatItemTaxRate(r.item_tax_rate) || r.item_tax_template || "—",
                },
                {
                  key: "amount",
                  label: "Amount",
                  width: "0.9fr",
                  align: "end",
                  render: (r) => money(r.amount),
                },
              ],
              rows: invoice.items ?? [],
              rowKey: "name",
              emptyMessage: "No items",
              footer: [
                null,
                null,
                null,
                null,
                null,
                null,
                { value: "Net Total", align: "end" },
                { value: money(invoice.net_total), align: "end" },
              ],
            },
            ...(invoice.packed_items?.length
              ? [
                  {
                    type: "table",
                    title: "Bundle Components",
                    columns: [
                      { key: "parent_item", label: "Bundle Item", width: "1.4fr" },
                      { key: "item_code", label: "Component", width: "1.4fr" },
                      { key: "qty", label: "Qty", width: "0.6fr", align: "center" },
                      { key: "uom", label: "UOM", width: "0.7fr" },
                      { key: "warehouse", label: "Warehouse", width: "1.2fr" },
                    ],
                    rows: invoice.packed_items,
                    rowKey: "name",
                    emptyMessage: "No bundle components",
                  },
                ]
              : []),
            {
              type: "fields",
              title: "Additional Discount",
              fields: [
                { label: "Apply Discount On", value: invoice.apply_discount_on },
                {
                  label: "Additional Discount Percentage",
                  value: invoice.additional_discount_percentage ? `${invoice.additional_discount_percentage}%` : "",
                  mono: true,
                  muted: !invoice.additional_discount_percentage,
                },
                {
                  label: "Additional Discount Amount",
                  value: money(invoice.discount_amount),
                  mono: true,
                  muted: !invoice.discount_amount,
                },
              ],
            },
            {
              type: "table",
              title: "Taxes and Charges",
              columns: [
                { key: "account_head", label: "Account Head", width: "1.6fr" },
                { key: "charge_type", label: "Type", width: "1fr" },
                { key: "rate", label: "Rate", width: "0.7fr", align: "end" },
                {
                  key: "tax_amount",
                  label: "Amount",
                  width: "1fr",
                  align: "end",
                  render: (r) => money(r.tax_amount),
                },
                {
                  key: "total",
                  label: "Total",
                  width: "1fr",
                  align: "end",
                  render: (r) => money(r.total),
                },
              ],
              rows: invoice.taxes ?? [],
              rowKey: "name",
              emptyMessage: "No taxes applied",
            },
            {
              type: "fields",
              title: "Taxes and Charges",
              fields: [
                { label: "Tax Category", value: invoice.tax_category },
                { label: "Sales Taxes and Charges Template", value: invoice.taxes_and_charges },
                { label: "Net Total", value: money(invoice.net_total), mono: true },
                { label: "Total Taxes and Charges", value: money(invoice.total_taxes_and_charges), mono: true },
                { label: "Rounding Adjustment", value: money(invoice.rounding_adjustment), mono: true },
                { label: "Rounded Total", value: money(invoice.rounded_total), mono: true },
              ],
            },
            {
              type: "table",
              title: "Payments",
              columns: [
                { key: "mode_of_payment", label: "Mode of Payment", width: "2fr" },
                {
                  key: "amount",
                  label: "Amount",
                  width: "1fr",
                  align: "end",
                  render: (r) => money(r.amount),
                },
              ],
              rows: invoice.payments ?? [],
              rowKey: "name",
              emptyMessage: "No payments",
            },
          ]
        }
      />

      <ConfirmModal
        open={cancelOpen}
        onClose={() => (cancelling ? null : setCancelOpen(false))}
        onConfirm={handleCancel}
        title="Cancel Invoice"
        message={`Are you sure you want to cancel ${invoice?.name}? This cannot be undone.`}
        confirmLabel="Yes, Cancel"
        cancelLabel="No"
        danger
        loading={cancelling}
        error={cancelError}
      />

      <CreditNoteModal
        open={creditNoteOpen}
        onClose={() => setCreditNoteOpen(false)}
        invoice={invoice}
        currencySymbol={currencySymbol}
        onCreated={handleCreditNoteCreated}
      />
    </>
  );
};

export default InvoiceDetailPage;
