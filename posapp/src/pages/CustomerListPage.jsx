import { __, _t, tData, useTranslation } from "../translation";
import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { fetchCustomers, fetchCustomerGroups, fetchTerritories } from "../api/Customer";
import { ListTable, FilterChips, Pagination, SelectField, TextField, FilterBar } from "../components/common";
import NewCustomerModal from "../components/Customer/NewCustomerModal";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { label: _t("All"), value: "" },
  { label: _t("Active"), value: "Active" },
  { label: _t("Inactive"), value: "Inactive" },
];

const CUSTOMER_COLUMNS = [
  {
    key: "customer_name",
    label: _t("Customer"),
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
    label: _t("Mobile No"),
    width: "1fr",
    render: (c) => <span style={{ color: "var(--color-text-muted)" }}>{c.mobile_no || "—"}</span>,
  },
  {
    key: "email_id",
    label: _t("Email"),
    width: "1.3fr",
    render: (c) => <span style={{ color: "var(--color-text-muted)" }}>{c.email_id || "—"}</span>,
  },
  {
    key: "customer_group",
    label: _t("Group"),
    width: "0.9fr",
    render: (c) => <span style={{ color: "var(--color-text-muted)" }}>{c.customer_group ? tData(c.customer_group) : "—"}</span>,
  },
  {
    key: "territory",
    label: _t("Territory"),
    width: "0.9fr",
    render: (c) => <span style={{ color: "var(--color-text-muted)" }}>{c.territory ? tData(c.territory) : "—"}</span>,
  },
  {
    key: "disabled",
    label: _t("Status"),
    width: "0.8fr",
    render: (c) => (
      <span className={c.disabled ? "pos-badge" : "pos-badge pos-badge-paid"}>
        {c.disabled ? __("Inactive") : __("Active")}
      </span>
    ),
  },
];

const CustomerListPage = () => {
  const { __ } = useTranslation();
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
      title: _t("Customers"),
      searchValue: search,
      onSearchChange: (value) => {
        setPage(0);
        setSearch(value);
      },
      searchPlaceholder: _t("Search customer, mobile or email"),
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
        <div className="d-flex align-items-center justify-content-between px-4 pt-3 pos-list-toolbar">
          <FilterChips options={STATUS_FILTERS} value={status} onChange={resetToFirstPage(setStatus)} />
          <button
            type="button"
            className="pos-btn pos-btn-primary"
            style={{ height: 32, fontSize: "12.5px", padding: "0 14px" }}
            onClick={() => setShowNewModal(true)}
          >
            <i className="bi bi-plus-lg" style={{ fontSize: 14 }} />
            {__("New customer")}
          </button>
        </div>

        <FilterBar active={Boolean(hasActiveFilters)}>
            <div style={{ width: 180 }}>
              <SelectField
                label={__("Customer Group")}
                placeholder={__("All groups")}
                value={customerGroup}
                onChange={resetToFirstPage(setCustomerGroup)}
                options={customerGroups.map((g) => ({ label: tData(g.name), value: g.name }))}
              />
            </div>
            <div style={{ width: 160 }}>
              <SelectField
                label={__("Territory")}
                placeholder={__("All territories")}
                value={territory}
                onChange={resetToFirstPage(setTerritory)}
                options={territories.map((t) => ({ label: tData(t.name), value: t.name }))}
              />
            </div>
            <div style={{ width: 160 }}>
              <TextField
                label={__("Mobile No")}
                value={mobileNo}
                onChange={resetToFirstPage(setMobileNo)}
                placeholder={__("Filter by mobile")}
                size="sm"
              />
            </div>
            <div style={{ width: 200 }}>
              <TextField
                label={__("Email")}
                value={emailId}
                onChange={resetToFirstPage(setEmailId)}
                placeholder={__("Filter by email")}
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
                {__("Clear filters")}
              </button>
            )}

        </FilterBar>

        <div className="d-flex flex-column flex-fill px-4 pt-2 pb-4" style={{ minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ListTable
              columns={CUSTOMER_COLUMNS}
              rows={customers}
              loading={loading}
              emptyMessage={__("No customers found")}
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
