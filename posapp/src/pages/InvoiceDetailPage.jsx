import { getServerMessage } from "../utils/serverError";
import { _t, tData, useTranslation } from "../translation";
import { useEffect, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { fetchInvoice, cancelInvoice } from "../api/Invoice";
import { getPendingInvoices, retryOfflineInvoice } from "../engine/outbox";
import usePOSSessionStore from "../store/posSessionStore";
import { FormView, ConfirmModal, ErrorAlert } from "../components/common";
import CreditNoteModal from "../components/Invoice/CreditNoteModal";
import { chargeTypeLabel, formatDate, invoiceStatusBadgeClass, invoiceStatusLabel } from "../utils/format";
import useEngineSettingsStore from "../engine/settingsStore";
import useConnectivityStore from "../engine/connectivity";
import useCurrencyFormatter from "../hooks/useCurrencyFormatter";

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
  const { __ } = useTranslation();
  const { name } = useParams();
  const navigate = useNavigate();
  const { setTopbar } = useOutletContext();

  const [invoice, setInvoice] = useState(null);
  // Formatted in the invoice's own currency, not the open shift's — the
  // Invoices list spans every profile, each possibly in a different currency.
  const formatCurrency = useCurrencyFormatter([invoice?.currency]);
  const companyCurrency = usePOSSessionStore((s) => s.companyCurrency);
  const sessionCompany = usePOSSessionStore((s) => s.openingDetail?.company);
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
      setRetryError(result?.error || __("Sync failed — check the Sync page for details."));
      loadInvoice();
    }
  };

  useEffect(() => {
    setTopbar({ title: invoice?.name || pendingRow?.display_id || _t("Invoice") });
  }, [invoice, pendingRow, setTopbar]);

  const money = (value) => formatCurrency(value, invoice?.currency);

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
      setCancelError(getServerMessage(err) || __("Failed to cancel invoice"));
    } finally {
      setCancelling(false);
    }
  };

  const handleCreditNoteCreated = (creditNote) => {
    navigate(`/posapp/invoices/${encodeURIComponent(creditNote.name)}`);
  };

  if (isOfflineDisplayId(name)) {
    if (loading) {
      return <div className="px-4 py-5 text-center text-muted" style={{ fontSize: 13 }}>{__("Loading…")}</div>;
    }
    if (!pendingRow) {
      return (
        <div className="px-4 py-5 text-center text-muted" style={{ fontSize: 13 }}>
          {__("This offline sale isn't in the local queue on this device anymore.")}
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
            {pendingRow.status === "failed" ? __("Sync failed") : pendingRow.status === "syncing" ? __("Syncing…") : __("Pending sync")}
          </span>
        </div>
        <div className="pos-card mb-3" style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--color-text-muted)" }}>
          <i className="bi bi-cloud-slash me-2" />
          {__(
            "This sale was completed offline and hasn't reached ERPNext yet. It will get a real invoice number once it syncs — reconnect and it should sync automatically, or retry below.",
          )}
        </div>
        <ErrorAlert message={retryError} />
        <div className="pos-card mb-3" style={{ padding: "16px" }}>
          <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginBottom: 8 }}>{__("ITEMS")}</div>
          {rows.map((r, i) => (
            <div key={i} className="d-flex justify-content-between" style={{ fontSize: 13, padding: "4px 0" }}>
              <span>{r.item_code} × {r.qty}</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{money(r.amount)}</span>
            </div>
          ))}
          <div className="d-flex justify-content-between" style={{ fontSize: 13, fontWeight: 600, borderTop: "1px solid var(--color-border-soft)", marginTop: 8, paddingTop: 8 }}>
            <span>{__("Total")}</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>{money(total)}</span>
          </div>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="pos-btn pos-btn-secondary" onClick={() => navigate("/posapp/invoices")}>
            {__("Back to Invoices")}
          </button>
          <button type="button" className="pos-btn pos-btn-primary" onClick={handleRetrySync} disabled={retrying || !isOnline}>
            {retrying ? (
              <><span className="spinner-border spinner-border-sm" role="status" /> {__("Syncing…")}</>
            ) : (
              <><i className="bi bi-arrow-repeat" style={{ fontSize: 14 }} /> {__("Retry sync")}</>
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
        {offlineUnavailable ? __("Invoice details aren't available offline. Reconnect and try again.") : __("Invoice not found.")}
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
        backLabel={__("Invoices")}
        title={invoice?.name}
        subtitle={invoice?.pos_profile}
        badge={invoice && <span className={invoiceStatusBadgeClass(invoice.status)}>{invoiceStatusLabel(invoice.status)}</span>}
        actions={
          <>
            {canReturn && (
              <button type="button" className="pos-btn pos-btn-secondary" onClick={() => setCreditNoteOpen(true)}>
                <i className="bi bi-arrow-return-left" style={{ fontSize: 14 }} /> {__("Create Credit Note")}
              </button>
            )}
            {canCancel && (
              <button type="button" className="pos-btn pos-btn-danger" onClick={() => setCancelOpen(true)}>
                <i className="bi bi-x-circle" style={{ fontSize: 14 }} /> {__("Cancel Invoice")}
              </button>
            )}
            <button type="button" className="pos-btn pos-btn-primary" onClick={openPrintView}>
              <i className="bi bi-printer" style={{ fontSize: 14 }} /> {__("Print / Reprint")}
            </button>
          </>
        }
        blocks={
          invoice && [
            {
              type: "fields",
              title: _t("Invoice Details"),
              fields: [
                { label: _t("Customer"), value: invoice.customer_name || invoice.customer },
                { label: _t("Posting Date"), value: formatDate(invoice.posting_date) },
                { label: _t("Posting Time"), value: invoice.posting_time, mono: true },
                { label: _t("POS Profile"), value: invoice.pos_profile },
                { label: _t("POS Opening Entry"), value: invoice.custom_ep_opening_entry, mono: true },
                { label: _t("Currency"), value: invoice.currency },
                ...(invoice.currency && invoice.conversion_rate && invoice.conversion_rate !== 1
                  ? [
                      {
                        label: _t("Exchange Rate"),
                        value: `1 ${invoice.currency} = ${invoice.conversion_rate}${
                          invoice.company === sessionCompany ? ` ${companyCurrency}` : ""
                        }`,
                        mono: true,
                      },
                    ]
                  : []),
                { label: _t("Price List"), value: invoice.selling_price_list },
                { label: _t("Warehouse"), value: invoice.set_warehouse },
                ...(invoice.is_return
                  ? [{ label: _t("Return Against"), value: invoice.return_against, mono: true }]
                  : []),
                { label: _t("Grand Total"), value: money(invoice.grand_total), mono: true },
                { label: _t("Paid Amount"), value: money(invoice.paid_amount), mono: true },
                {
                  label: _t("Outstanding Amount"),
                  value: money(invoice.outstanding_amount),
                  mono: true,
                  muted: !invoice.outstanding_amount,
                },
              ],
            },
            {
              type: "table",
              title: _t("Items"),
              columns: [
                { key: "item_code", label: _t("Item"), width: "1.6fr" },
                { key: "qty", label: _t("Qty"), width: "0.6fr", align: "center" },
                { key: "uom", label: _t("UOM"), width: "0.7fr" },
                {
                  key: "rate",
                  label: _t("Rate"),
                  width: "0.9fr",
                  align: "end",
                  render: (r) => money(r.rate),
                },
                {
                  key: "discount_percentage",
                  label: _t("Discount %"),
                  width: "0.8fr",
                  align: "end",
                  render: (r) => (r.discount_percentage ? `${r.discount_percentage}%` : "—"),
                },
                {
                  key: "discount_amount",
                  label: _t("Discount Amt"),
                  width: "0.9fr",
                  align: "end",
                  render: (r) => (r.discount_amount ? money(r.discount_amount) : "—"),
                },
                {
                  key: "item_tax_rate",
                  label: _t("Item Tax"),
                  width: "1.3fr",
                  render: (r) => formatItemTaxRate(r.item_tax_rate) || r.item_tax_template || "—",
                },
                {
                  key: "amount",
                  label: _t("Amount"),
                  width: "0.9fr",
                  align: "end",
                  render: (r) => money(r.amount),
                },
              ],
              rows: invoice.items ?? [],
              rowKey: "name",
              emptyMessage: _t("No items"),
              footer: [
                null,
                null,
                null,
                null,
                null,
                null,
                { value: __("Net Total"), align: "end" },
                { value: money(invoice.net_total), align: "end" },
              ],
            },
            ...(invoice.packed_items?.length
              ? [
                  {
                    type: "table",
                    title: _t("Bundle Components"),
                    columns: [
                      { key: "parent_item", label: _t("Bundle Item"), width: "1.4fr" },
                      { key: "item_code", label: _t("Component"), width: "1.4fr" },
                      { key: "qty", label: _t("Qty"), width: "0.6fr", align: "center" },
                      { key: "uom", label: _t("UOM"), width: "0.7fr" },
                      { key: "warehouse", label: _t("Warehouse"), width: "1.2fr" },
                    ],
                    rows: invoice.packed_items,
                    rowKey: "name",
                    emptyMessage: _t("No bundle components"),
                  },
                ]
              : []),
            {
              type: "fields",
              title: _t("Additional Discount"),
              fields: [
                { label: _t("Apply Discount On"), value: invoice.apply_discount_on ? __(invoice.apply_discount_on) : "" },
                {
                  label: _t("Additional Discount Percentage"),
                  value: invoice.additional_discount_percentage ? `${invoice.additional_discount_percentage}%` : "",
                  mono: true,
                  muted: !invoice.additional_discount_percentage,
                },
                {
                  label: _t("Additional Discount Amount"),
                  value: money(invoice.discount_amount),
                  mono: true,
                  muted: !invoice.discount_amount,
                },
              ],
            },
            {
              type: "table",
              title: _t("Taxes and Charges"),
              columns: [
                { key: "account_head", label: _t("Account Head"), width: "1.6fr" },
                { key: "charge_type", label: _t("Type"), width: "1fr", render: (r) => chargeTypeLabel(r.charge_type) },
                { key: "rate", label: _t("Rate"), width: "0.7fr", align: "end" },
                {
                  key: "tax_amount",
                  label: _t("Amount"),
                  width: "1fr",
                  align: "end",
                  render: (r) => money(r.tax_amount),
                },
                {
                  key: "total",
                  label: _t("Total"),
                  width: "1fr",
                  align: "end",
                  render: (r) => money(r.total),
                },
              ],
              rows: invoice.taxes ?? [],
              rowKey: "name",
              emptyMessage: _t("No taxes applied"),
            },
            {
              type: "fields",
              title: _t("Taxes and Charges"),
              fields: [
                { label: _t("Tax Category"), value: invoice.tax_category },
                { label: _t("Sales Taxes and Charges Template"), value: invoice.taxes_and_charges },
                { label: _t("Net Total"), value: money(invoice.net_total), mono: true },
                { label: _t("Total Taxes and Charges"), value: money(invoice.total_taxes_and_charges), mono: true },
                { label: _t("Rounding Adjustment"), value: money(invoice.rounding_adjustment), mono: true },
                { label: _t("Rounded Total"), value: money(invoice.rounded_total), mono: true },
              ],
            },
            {
              type: "table",
              title: _t("Payments"),
              columns: [
                { key: "mode_of_payment", label: _t("Mode of Payment"), width: "2fr", render: (r) => tData(r.mode_of_payment) },
                {
                  key: "amount",
                  label: _t("Amount"),
                  width: "1fr",
                  align: "end",
                  render: (r) => money(r.amount),
                },
              ],
              rows: invoice.payments ?? [],
              rowKey: "name",
              emptyMessage: _t("No payments"),
            },
          ]
        }
      />

      <ConfirmModal
        open={cancelOpen}
        onClose={() => (cancelling ? null : setCancelOpen(false))}
        onConfirm={handleCancel}
        title={__("Cancel Invoice")}
        message={__("Are you sure you want to cancel {name}? This cannot be undone.", { name: invoice?.name })}
        confirmLabel={__("Yes, Cancel")}
        cancelLabel={__("No")}
        danger
        loading={cancelling}
        error={cancelError}
      />

      <CreditNoteModal
        open={creditNoteOpen}
        onClose={() => setCreditNoteOpen(false)}
        invoice={invoice}
        onCreated={handleCreditNoteCreated}
      />
    </>
  );
};

export default InvoiceDetailPage;
