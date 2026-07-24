import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { fetchProfiles } from "../api/POSProfile";
import { fetchCompanies } from "../api/Company";
import { ListTable, FilterChips, Pagination, SelectField } from "../components/common";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Active", value: "Active" },
  { label: "Disabled", value: "Disabled" },
];

const PROFILE_COLUMNS = [
  {
    key: "name",
    label: "Profile",
    width: "1.4fr",
    render: (p) => (
      <div>
        <div>{p.name}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-faint)" }}>{p.company}</div>
      </div>
    ),
  },
  {
    key: "warehouse",
    label: "Warehouse",
    width: "1fr",
    render: (p) => <span style={{ color: "var(--color-text-muted)" }}>{p.warehouse || "—"}</span>,
  },
  {
    key: "selling_price_list",
    label: "Price List",
    width: "1fr",
    render: (p) => <span style={{ color: "var(--color-text-muted)" }}>{p.selling_price_list || "—"}</span>,
  },
  {
    key: "disabled",
    label: "Status",
    width: "0.8fr",
    render: (p) => (
      <span className={p.disabled ? "pos-badge" : "pos-badge pos-badge-paid"}>
        {p.disabled ? "Disabled" : "Active"}
      </span>
    ),
  },
];

const POSProfileListPage = () => {
  const { setTopbar } = useOutletContext();
  const navigate = useNavigate();

  const [status, setStatus] = useState("");
  const [company, setCompany] = useState("");
  const [search, setSearch] = useState("");

  const [companies, setCompanies] = useState([]);

  const [profiles, setProfiles] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanies().then((data) => setCompanies(data ?? []));
  }, []);

  const loadProfiles = () => {
    setLoading(true);
    fetchProfiles({ status, company, search }, page * PAGE_SIZE, PAGE_SIZE).then((data) => {
      setProfiles(data?.profiles ?? []);
      setTotalCount(data?.total_count ?? 0);
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(loadProfiles, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, company, search]);

  useEffect(() => {
    setTopbar({
      title: "POS Profiles",
      searchValue: search,
      onSearchChange: (value) => {
        setPage(0);
        setSearch(value);
      },
      searchPlaceholder: "Search profile or warehouse",
    });
  }, [setTopbar, search]);

  const resetToFirstPage = (setter) => (value) => {
    setPage(0);
    setter(value);
  };

  const clearFilters = () => {
    setPage(0);
    setCompany("");
  };

  const hasActiveFilters = Boolean(company);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="d-flex flex-column flex-fill" style={{ minHeight: 0 }}>
      <div className="d-flex align-items-center justify-content-between px-4 pt-3">
        <FilterChips options={STATUS_FILTERS} value={status} onChange={resetToFirstPage(setStatus)} />
        <Link to="/posapp/pos-profile/new" className="pos-btn pos-btn-primary" style={{ height: 32, fontSize: "12.5px", padding: "0 14px" }}>
          <i className="bi bi-plus-lg" style={{ fontSize: 14 }} />
          New profile
        </Link>
      </div>

      <div className="px-4 pt-3">
        <div className="d-flex align-items-end gap-2">
          <div style={{ width: 220 }}>
            <SelectField
              label="Company"
              placeholder="All companies"
              value={company}
              onChange={resetToFirstPage(setCompany)}
              options={companies.map((c) => ({ label: c.company_name, value: c.name }))}
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
            columns={PROFILE_COLUMNS}
            rows={profiles}
            loading={loading}
            emptyMessage="No POS Profiles found"
            onRowClick={(p) => navigate(`/posapp/pos-profile/${encodeURIComponent(p.name)}`)}
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
  );
};

export default POSProfileListPage;
