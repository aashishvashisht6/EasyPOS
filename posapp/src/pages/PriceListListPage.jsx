import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { fetchPriceLists } from "../api/PriceList";
import { ListTable, FilterChips, Pagination } from "../components/common";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Active", value: "Active" },
  { label: "Disabled", value: "Disabled" },
];

const PRICE_LIST_COLUMNS = [
  {
    key: "price_list_name",
    label: "Price List",
    width: "1.4fr",
    render: (p) => <div>{p.price_list_name || p.name}</div>,
  },
  {
    key: "currency",
    label: "Currency",
    width: "0.8fr",
    render: (p) => <span style={{ color: "var(--color-text-muted)" }}>{p.currency || "—"}</span>,
  },
  {
    key: "selling",
    label: "Selling",
    width: "0.7fr",
    render: (p) => <span className={p.selling ? "pos-badge pos-badge-paid" : "pos-badge"}>{p.selling ? "Yes" : "No"}</span>,
  },
  {
    key: "buying",
    label: "Buying",
    width: "0.7fr",
    render: (p) => <span className={p.buying ? "pos-badge pos-badge-paid" : "pos-badge"}>{p.buying ? "Yes" : "No"}</span>,
  },
  {
    key: "enabled",
    label: "Status",
    width: "0.8fr",
    render: (p) => (
      <span className={p.enabled ? "pos-badge pos-badge-paid" : "pos-badge"}>{p.enabled ? "Active" : "Disabled"}</span>
    ),
  },
];

const PriceListListPage = () => {
  const { setTopbar } = useOutletContext();
  const navigate = useNavigate();

  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const [priceLists, setPriceLists] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadPriceLists = () => {
    setLoading(true);
    fetchPriceLists({ status, search }, page * PAGE_SIZE, PAGE_SIZE).then((data) => {
      setPriceLists(data?.priceLists ?? []);
      setTotalCount(data?.total_count ?? 0);
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(loadPriceLists, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, search]);

  useEffect(() => {
    setTopbar({
      title: "Price Lists",
      searchValue: search,
      onSearchChange: (value) => {
        setPage(0);
        setSearch(value);
      },
      searchPlaceholder: "Search price list",
    });
  }, [setTopbar, search]);

  const resetToFirstPage = (setter) => (value) => {
    setPage(0);
    setter(value);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="d-flex flex-column flex-fill" style={{ minHeight: 0 }}>
      <div className="d-flex align-items-center justify-content-between px-4 pt-3">
        <FilterChips options={STATUS_FILTERS} value={status} onChange={resetToFirstPage(setStatus)} />
        <Link
          to="/posapp/price-list/new"
          className="pos-btn pos-btn-primary"
          style={{ height: 32, fontSize: "12.5px", padding: "0 14px" }}
        >
          <i className="bi bi-plus-lg" style={{ fontSize: 14 }} />
          New price list
        </Link>
      </div>

      <div className="d-flex flex-column flex-fill px-4 pt-3 pb-4" style={{ minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ListTable
            columns={PRICE_LIST_COLUMNS}
            rows={priceLists}
            loading={loading}
            emptyMessage="No price lists found"
            onRowClick={(p) => navigate(`/posapp/price-list/${encodeURIComponent(p.name)}`)}
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

export default PriceListListPage;
