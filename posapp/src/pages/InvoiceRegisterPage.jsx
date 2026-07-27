import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import usePOSSessionStore from "../store/posSessionStore";
import { fetchInvoices } from "../api/InvoiceRegister";
import { ListTable, FilterChips, Pagination, LinkField, TextField } from "../components/common";
import { formatDate, invoiceStatusBadgeClass } from "../utils/format";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Paid", value: "Paid" },
  { label: "Unpaid", value: "Unpaid" },
  { label: "Overdue", value: "Overdue" },
];

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
    render: (inv) => <span className={invoiceStatusBadgeClass(inv.status)}>{inv.status}</span>,
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
  const [searchParams] = useSearchParams();
  const openingDetail = usePOSSessionStore((s) => s.openingDetail);

  const [status, setStatus] = useState("");
  const [customer, setCustomer] = useState(() => searchParams.get("customer") || "");
  const [customerName, setCustomerName] = useState(() => searchParams.get("customerName") || "");
  const [posProfile, setPosProfile] = useState(() => openingDetail?.pos_profile ?? "");
  const [posProfileTouched, setPosProfileTouched] = useState(false);
  const [mobileNo, setMobileNo] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadInvoices = () => {
    setLoading(true);
    const filters = {
      pos_profile: posProfile,
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
  }, [page, status, customer, posProfile, mobileNo, email]);

  // openingDetail hydrates asynchronously after mount (see posSessionStore) —
  // default the filter to the open shift's profile once it becomes available,
  // but don't clobber a value the user has already picked/cleared themselves.
  useEffect(() => {
    if (!posProfileTouched && openingDetail?.pos_profile) {
      setPosProfile(openingDetail.pos_profile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingDetail?.pos_profile]);

  const resetToFirstPage = (setter) => (value) => {
    setPage(0);
    setter(value);
  };

  const clearFilters = () => {
    setPage(0);
    setCustomer("");
    setCustomerName("");
    setPosProfile("");
    setPosProfileTouched(true);
    setMobileNo("");
    setEmail("");
  };

  const hasActiveFilters = customer || posProfile || mobileNo || email;

  useEffect(() => {
    setTopbar({
      title: "Invoices",
      searchValue: search,
      onSearchChange: setSearch,
      searchPlaceholder: "Search invoice or customer",
    });
  }, [setTopbar, search]);

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
            <div style={{ width: 200 }}>
              <LinkField
                label="POS Profile"
                doctype="POS Profile"
                value={posProfile}
                onChange={(docname) => {
                  setPage(0);
                  setPosProfile(docname ?? "");
                  setPosProfileTouched(true);
                }}
                placeholder="Filter by POS Profile"
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
              onRowClick={(inv) => navigate(`/posapp/invoices/${encodeURIComponent(inv.name)}`)}
              rowStyle={(inv) =>
                inv.status?.startsWith("Overdue") ? { background: "var(--color-warning-bg-soft)" } : null
              }
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
    </>
  );
};

export default InvoiceRegisterPage;
