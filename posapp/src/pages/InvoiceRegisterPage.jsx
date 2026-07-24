import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import usePOSSessionStore from "../store/posSessionStore";
import { fetchInvoices } from "../api/InvoiceRegister";
import { fetchInvoice } from "../api/Invoice";
import { Modal, ListTable, FilterChips, Pagination, LinkField, TextField } from "../components/common";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Paid", value: "Paid" },
  { label: "Unpaid", value: "Unpaid" },
  { label: "Overdue", value: "Overdue" },
];

const badgeClass = (status) => {
  switch (status) {
    case "Paid":
      return "pos-badge pos-badge-paid";
    case "Unpaid":
    case "Unpaid and Discounted":
      return "pos-badge pos-badge-unpaid";
    case "Overdue":
    case "Overdue and Discounted":
      return "pos-badge pos-badge-overdue";
    default:
      return "pos-badge";
  }
};

const formatDate = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const INVOICE_COLUMNS = [
  {
    key: "name",
    label: "Invoice",
    width: "1fr",
    render: (inv) => <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>{inv.name}</span>,
  },
  {
    key: "customer",
    label: "Customer",
    width: "1.4fr",
    render: (inv) => inv.customer_name || inv.customer,
  },
  {
    key: "posting_date",
    label: "Date",
    width: "1fr",
    render: (inv) => <span style={{ color: "var(--color-text-muted)" }}>{formatDate(inv.posting_date)}</span>,
  },
  {
    key: "grand_total",
    label: "Amount",
    width: "0.9fr",
    render: (inv) => <span style={{ fontFamily: "var(--font-mono)" }}>₹{inv.grand_total}</span>,
  },
  {
    key: "status",
    label: "Status",
    width: "0.9fr",
    render: (inv) => <span className={badgeClass(inv.status)}>{inv.status}</span>,
  },
  {
    key: "pos_profile",
    label: "Register",
    width: "0.9fr",
    render: (inv) => <span style={{ color: "var(--color-text-muted)" }}>{inv.pos_profile}</span>,
  },
];

const InvoiceRegisterPage = () => {
  const { setTopbar } = useOutletContext();
  const navigate = useNavigate();
  const openingDetail = usePOSSessionStore((s) => s.openingDetail);

  const [status, setStatus] = useState("");
  const [customer, setCustomer] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const loadInvoices = () => {
    setLoading(true);
    const filters = {
      pos_profile: openingDetail?.pos_profile ?? "",
      status,
      customer,
      mobile_no: mobileNo,
      email,
    };
    fetchInvoices(filters, page * PAGE_SIZE, PAGE_SIZE).then((data) => {
      setInvoices(data?.invoices ?? []);
      setTotalCount(data?.total_count ?? 0);
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(loadInvoices, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, customer, mobileNo, email]);

  const resetToFirstPage = (setter) => (value) => {
    setPage(0);
    setter(value);
  };

  const clearFilters = () => {
    setPage(0);
    setCustomer("");
    setCustomerName("");
    setMobileNo("");
    setEmail("");
  };

  const hasActiveFilters = customer || mobileNo || email;

  useEffect(() => {
    setTopbar({
      title: "Invoices",
      searchValue: search,
      onSearchChange: setSearch,
      searchPlaceholder: "Search invoice or customer",
    });
  }, [setTopbar, search]);

  const openDetail = (name) => {
    fetchInvoice(name).then((doc) => setSelectedInvoice(doc));
  };

  const openPrintView = (name) => {
    window.open(
      `/printview?doctype=Sales%20Invoice&name=${encodeURIComponent(name)}`,
      "_blank",
    );
  };

  const visibleInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter(
      (inv) =>
        inv.name?.toLowerCase().includes(term) ||
        (inv.customer_name || inv.customer || "").toLowerCase().includes(term),
    );
  }, [invoices, search]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <>
      <div className="d-flex flex-column flex-fill" style={{ minHeight: 0 }}>
        <div className="d-flex align-items-center justify-content-between px-4 pt-3">
          <FilterChips
            options={STATUS_FILTERS.map((f) => ({ ...f, danger: f.value === "Overdue" }))}
            value={status}
            onChange={resetToFirstPage(setStatus)}
          />
          <button
            type="button"
            className="pos-btn pos-btn-primary"
            style={{ height: 32, fontSize: "12.5px", padding: "0 14px" }}
            onClick={() => navigate("/posapp/terminal")}
          >
            <i className="bi bi-plus-lg" style={{ fontSize: 14 }} />
            New invoice
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="d-flex align-items-end gap-2">
            <div style={{ width: 220 }}>
              <LinkField
                label="Customer"
                doctype="Customer"
                value={customer}
                displayValue={customerName}
                onChange={(docname, option) => {
                  setPage(0);
                  setCustomer(docname ?? "");
                  setCustomerName(docname ? option?.label || option?.description || docname : "");
                }}
                placeholder="Filter by customer"
                size="sm"
              />
            </div>
            <div style={{ width: 180 }}>
              <TextField
                label="Mobile No"
                value={mobileNo}
                onChange={resetToFirstPage(setMobileNo)}
                placeholder="Filter by mobile"
                size="sm"
              />
            </div>
            <div style={{ width: 220 }}>
              <TextField
                label="Email"
                value={email}
                onChange={resetToFirstPage(setEmail)}
                placeholder="Filter by email"
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
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="d-flex flex-column flex-fill px-4 pt-2 pb-4" style={{ minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ListTable
              columns={INVOICE_COLUMNS}
              rows={visibleInvoices}
              loading={loading}
              emptyMessage="No invoices found"
              onRowClick={(inv) => openDetail(inv.name)}
              rowStyle={(inv) => ({
                background: inv.status?.startsWith("Overdue") ? "var(--color-warning-bg-soft)" : "transparent",
              })}
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

      <Modal
        open={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={selectedInvoice?.name}
        subtitle={selectedInvoice?.customer}
        size="lg"
        footer={
          <button
            type="button"
            className="pos-btn pos-btn-primary"
            onClick={() => openPrintView(selectedInvoice.name)}
          >
            Print / Reprint
          </button>
        }
      >
        {selectedInvoice && (
          <>
            <p className="mb-3" style={{ fontSize: 13 }}>
              <strong>Grand Total:</strong> ₹{selectedInvoice.grand_total}
            </p>

            <h6>Items</h6>
            <table className="table table-sm table-bordered mb-3">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-center">Qty</th>
                  <th className="text-end">Rate</th>
                  <th className="text-end">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(selectedInvoice.items ?? []).map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.item_code}</td>
                    <td className="text-center">{item.qty}</td>
                    <td className="text-end">₹{item.rate}</td>
                    <td className="text-end">₹{item.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h6>Payments</h6>
            <table className="table table-sm table-bordered mb-0">
              <thead>
                <tr>
                  <th>Mode of Payment</th>
                  <th className="text-end">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(selectedInvoice.payments ?? []).map((p, idx) => (
                  <tr key={idx}>
                    <td>{p.mode_of_payment}</td>
                    <td className="text-end">₹{p.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Modal>
    </>
  );
};

export default InvoiceRegisterPage;
