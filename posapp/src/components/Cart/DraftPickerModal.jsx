import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { fetchInvoices } from "../../api/InvoiceRegister";
import { getPendingInvoices } from "../../engine/outbox";
import { Modal, ListTable, Pagination, LinkField, TextField } from "../common";
import usePOSSessionStore from "../../store/posSessionStore";
import { formatDate } from "../../utils/format";

const PAGE_SIZE = 10;

const buildDraftColumns = (t) => [
  {
    key: "name",
    label: t("Invoice"),
    width: "1fr",
    render: (inv) => (
      <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>
        {inv.name}
        {inv.__offline && (
          <span
            className="badge bg-warning-subtle text-warning-emphasis ms-2"
            style={{ fontSize: 9.5, fontWeight: 500 }}
            title={inv.__pending?.status === "failed" ? inv.__pending?.error : t("Held offline — not yet synced")}
          >
            {inv.__pending?.status === "failed" ? t("Sync failed") : t("Offline")}
          </span>
        )}
      </span>
    ),
  },
  {
    key: "customer",
    label: t("Customer"),
    width: "1.3fr",
    render: (inv) => inv.customer_name || inv.customer,
  },
  {
    key: "posting_date",
    label: t("Date"),
    width: "0.9fr",
    render: (inv) => <span style={{ color: "var(--color-text-muted)" }}>{formatDate(inv.posting_date)}</span>,
  },
  {
    key: "grand_total",
    label: t("Amount"),
    width: "0.8fr",
    render: (inv) => <span style={{ fontFamily: "var(--font-mono)" }}>₹{inv.grand_total}</span>,
  },
];

const DraftPickerModal = ({ onClose, onSelect }) => {
  const { t } = useTranslation();
  const openingDetail = usePOSSessionStore((s) => s.openingDetail);

  const [customer, setCustomer] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [email, setEmail] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const columns = useMemo(() => buildDraftColumns(t), [t]);

  // Sales Invoices queued locally (submit=0, i.e. "Save Draft" made while
  // offline — see engine/outbox.js) that haven't synced to ERPNext yet. Only
  // shown on page 0 with no search filters active, ahead of the server list,
  // since they're not part of the server's own pagination/total_count.
  const loadPendingDrafts = async () => {
    const rows = await getPendingInvoices();
    return rows
      .filter((row) => !row.submit && row.status !== "synced")
      .filter((row) => !customer || row.payload?.invoice?.customer === customer)
      .map((row) => ({
        name: row.display_id,
        customer: row.payload?.invoice?.customer,
        customer_name: row.payload?.invoice?.customer,
        posting_date: row.created_at,
        grand_total: (row.payload?.invoice?.items ?? []).reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
        __offline: true,
        __pending: row,
      }));
  };

  const loadDrafts = async () => {
    const filters = {
      pos_profile: openingDetail?.pos_profile ?? "",
      status: "Draft",
      customer,
      mobile_no: mobileNo,
      email,
    };
    const [serverResult, pendingDrafts] = await Promise.all([
      fetchInvoices(filters, page * PAGE_SIZE, PAGE_SIZE).catch(() => null),
      page === 0 && !mobileNo && !email ? loadPendingDrafts() : Promise.resolve([]),
    ]);
    setDrafts([...pendingDrafts, ...(serverResult?.invoices ?? [])]);
    setTotalCount((serverResult?.total_count ?? 0) + pendingDrafts.length);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(loadDrafts, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, customer, mobileNo, email, openingDetail?.pos_profile]);

  const resetToFirstPage = (setter) => (value) => {
    setPage(0);
    setter(value);
  };

  const hasActiveFilters = customer || mobileNo || email;

  const clearFilters = () => {
    setPage(0);
    setCustomer("");
    setCustomerName("");
    setMobileNo("");
    setEmail("");
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <Modal open onClose={onClose} title={t("Load Draft")} subtitle={t("Search and pull a saved draft into the terminal")} size="lg">
      <div className="d-flex flex-column" style={{ height: 480, minHeight: 0 }}>
        <div style={{ flexShrink: 0 }}>
          <div className="d-flex align-items-end gap-2 flex-wrap">
            <div style={{ width: 200 }}>
              <LinkField
                label={t("Customer")}
                doctype="Customer"
                value={customer}
                displayValue={customerName}
                onChange={(docname, option) => {
                  setPage(0);
                  setCustomer(docname ?? "");
                  setCustomerName(docname ? option?.label || option?.description || docname : "");
                }}
                placeholder={t("Filter by customer")}
                size="sm"
              />
            </div>
            <div style={{ width: 160 }}>
              <TextField
                label={t("Mobile No")}
                value={mobileNo}
                onChange={resetToFirstPage(setMobileNo)}
                placeholder={t("Filter by mobile")}
                size="sm"
              />
            </div>
            <div style={{ width: 180 }}>
              <TextField
                label={t("Email")}
                value={email}
                onChange={resetToFirstPage(setEmail)}
                placeholder={t("Filter by email")}
                size="sm"
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                className="pos-btn pos-btn-secondary"
                style={{ height: 30, fontSize: 12, padding: "0 12px", marginBottom: 14 }}
                onClick={clearFilters}
              >
                {t("Clear filters")}
              </button>
            )}
          </div>
        </div>

        <div className="d-flex flex-column pt-2" style={{ flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ListTable
              columns={columns}
              rows={drafts}
              loading={loading}
              emptyMessage={t("No draft invoices found")}
              onRowClick={(inv) => onSelect(inv.__offline ? inv : inv.name)}
            />
          </div>

          <div style={{ flexShrink: 0, paddingTop: 16 }}>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DraftPickerModal;
