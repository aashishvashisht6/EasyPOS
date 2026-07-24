import { useEffect, useState } from "react";
import { fetchInvoices } from "../../api/InvoiceRegister";
import { Modal, ListTable, Pagination, LinkField, TextField } from "../common";
import usePOSSessionStore from "../../store/posSessionStore";

const PAGE_SIZE = 10;

const formatDate = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const DRAFT_COLUMNS = [
  {
    key: "name",
    label: "Invoice",
    width: "1fr",
    render: (inv) => <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>{inv.name}</span>,
  },
  {
    key: "customer",
    label: "Customer",
    width: "1.3fr",
    render: (inv) => inv.customer_name || inv.customer,
  },
  {
    key: "posting_date",
    label: "Date",
    width: "0.9fr",
    render: (inv) => <span style={{ color: "var(--color-text-muted)" }}>{formatDate(inv.posting_date)}</span>,
  },
  {
    key: "grand_total",
    label: "Amount",
    width: "0.8fr",
    render: (inv) => <span style={{ fontFamily: "var(--font-mono)" }}>₹{inv.grand_total}</span>,
  },
];

const DraftPickerModal = ({ onClose, onSelect }) => {
  const openingDetail = usePOSSessionStore((s) => s.openingDetail);

  const [customer, setCustomer] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [email, setEmail] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadDrafts = () => {
    const filters = {
      pos_profile: openingDetail?.pos_profile ?? "",
      status: "Draft",
      customer,
      mobile_no: mobileNo,
      email,
    };
    fetchInvoices(filters, page * PAGE_SIZE, PAGE_SIZE).then((data) => {
      setDrafts(data?.invoices ?? []);
      setTotalCount(data?.total_count ?? 0);
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(loadDrafts, 300);
    return () => clearTimeout(t);
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
    <Modal open onClose={onClose} title="Load Draft" subtitle="Search and pull a saved draft into the terminal" size="lg">
      <div className="d-flex flex-column" style={{ height: 480, minHeight: 0 }}>
        <div style={{ flexShrink: 0 }}>
          <div className="d-flex align-items-end gap-2 flex-wrap">
            <div style={{ width: 200 }}>
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
            <div style={{ width: 160 }}>
              <TextField
                label="Mobile No"
                value={mobileNo}
                onChange={resetToFirstPage(setMobileNo)}
                placeholder="Filter by mobile"
                size="sm"
              />
            </div>
            <div style={{ width: 180 }}>
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

        <div className="d-flex flex-column pt-2" style={{ flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ListTable
              columns={DRAFT_COLUMNS}
              rows={drafts}
              loading={loading}
              emptyMessage="No draft invoices found"
              onRowClick={(inv) => onSelect(inv.name)}
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
