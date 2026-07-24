import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { fetchCustomers, fetchCustomerGroups, fetchTerritories } from "../api/Customer";
import { ListTable, FilterChips, Pagination, SelectField, TextField } from "../components/common";
import NewCustomerModal from "../components/Customer/NewCustomerModal";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
];

const CUSTOMER_COLUMNS = [
  {
    key: "customer_name",
    label: "Customer",
    width: "1.4fr",
    render: (c) => (
      <div>
        <div>{c.customer_name}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-faint)" }}>{c.name}</div>
      </div>
    ),
  },
  {
    key: "mobile_no",
    label: "Mobile No",
    width: "1fr",
    render: (c) => <span style={{ color: "var(--color-text-muted)" }}>{c.mobile_no || "—"}</span>,
  },
  {
    key: "email_id",
    label: "Email",
    width: "1.3fr",
    render: (c) => <span style={{ color: "var(--color-text-muted)" }}>{c.email_id || "—"}</span>,
  },
  {
    key: "customer_group",
    label: "Group",
    width: "0.9fr",
    render: (c) => <span style={{ color: "var(--color-text-muted)" }}>{c.customer_group || "—"}</span>,
  },
  {
    key: "territory",
    label: "Territory",
    width: "0.9fr",
    render: (c) => <span style={{ color: "var(--color-text-muted)" }}>{c.territory || "—"}</span>,
  },
  {
    key: "disabled",
    label: "Status",
    width: "0.8fr",
    render: (c) => (
      <span className={c.disabled ? "pos-badge" : "pos-badge pos-badge-paid"}>
        {c.disabled ? "Inactive" : "Active"}
      </span>
    ),
  },
];

const CustomerListPage = () => {
  const { setTopbar } = useOutletContext();
  const navigate = useNavigate();

  const [status, setStatus] = useState("");
  const [customerGroup, setCustomerGroup] = useState("");
  const [territory, setTerritory] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [emailId, setEmailId] = useState("");
  const [search, setSearch] = useState("");

  const [customerGroups, setCustomerGroups] = useState([]);
  const [territories, setTerritories] = useState([]);

  const [customers, setCustomers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    fetchCustomerGroups().then((data) => setCustomerGroups(data ?? []));
    fetchTerritories().then((data) => setTerritories(data ?? []));
  }, []);

  const loadCustomers = () => {
    setLoading(true);
    fetchCustomers(
      { status, customer_group: customerGroup, territory, mobile_no: mobileNo, email_id: emailId, search },
      page * PAGE_SIZE,
      PAGE_SIZE,
    ).then((data) => {
      setCustomers(data?.customers ?? []);
      setTotalCount(data?.total_count ?? 0);
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(loadCustomers, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, customerGroup, territory, mobileNo, emailId, search]);

  useEffect(() => {
    setTopbar({
      title: "Customers",
      searchValue: search,
      onSearchChange: (value) => {
        setPage(0);
        setSearch(value);
      },
      searchPlaceholder: "Search customer, mobile or email",
    });
  }, [setTopbar, search]);

  const resetToFirstPage = (setter) => (value) => {
    setPage(0);
    setter(value);
  };

  const clearFilters = () => {
    setPage(0);
    setCustomerGroup("");
    setTerritory("");
    setMobileNo("");
    setEmailId("");
  };

  const hasActiveFilters = customerGroup || territory || mobileNo || emailId;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <>
      <div className="d-flex flex-column flex-fill" style={{ minHeight: 0 }}>
        <div className="d-flex align-items-center justify-content-between px-4 pt-3">
          <FilterChips options={STATUS_FILTERS} value={status} onChange={resetToFirstPage(setStatus)} />
          <button
            type="button"
            className="pos-btn pos-btn-primary"
            style={{ height: 32, fontSize: "12.5px", padding: "0 14px" }}
            onClick={() => setShowNewModal(true)}
          >
            <i className="bi bi-plus-lg" style={{ fontSize: 14 }} />
            New customer
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="d-flex align-items-end gap-2">
            <div style={{ width: 180 }}>
              <SelectField
                label="Customer Group"
                placeholder="All groups"
                value={customerGroup}
                onChange={resetToFirstPage(setCustomerGroup)}
                options={customerGroups.map((g) => ({ label: g.name, value: g.name }))}
              />
            </div>
            <div style={{ width: 160 }}>
              <SelectField
                label="Territory"
                placeholder="All territories"
                value={territory}
                onChange={resetToFirstPage(setTerritory)}
                options={territories.map((t) => ({ label: t.name, value: t.name }))}
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
            <div style={{ width: 200 }}>
              <TextField
                label="Email"
                value={emailId}
                onChange={resetToFirstPage(setEmailId)}
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
              columns={CUSTOMER_COLUMNS}
              rows={customers}
              loading={loading}
              emptyMessage="No customers found"
              onRowClick={(c) => navigate(`/posapp/customers/${encodeURIComponent(c.name)}`)}
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

      {showNewModal && (
        <NewCustomerModal
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false);
            loadCustomers();
          }}
        />
      )}
    </>
  );
};

export default CustomerListPage;
