import { useEffect, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { fetchInvoice, cancelInvoice } from "../api/Invoice";
import usePOSSessionStore from "../store/posSessionStore";
import { FormView, ConfirmModal } from "../components/common";
import CreditNoteModal from "../components/Invoice/CreditNoteModal";
import { formatDate, invoiceStatusBadgeClass } from "../utils/format";

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

  const loadInvoice = () => {
    fetchInvoice(name).then((data) => {
      setInvoice(data ?? null);
      setLoadedName(name);
    });
  };

  useEffect(() => {
    loadInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  useEffect(() => {
    setTopbar({ title: invoice?.name || "Invoice" });
  }, [invoice, setTopbar]);

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

  if (!loading && !invoice) {
    return (
      <div className="px-4 py-5 text-center text-muted" style={{ fontSize: 13 }}>
        Invoice not found.
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
