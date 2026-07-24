import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { fetchPricingRules } from "../api/PricingRule";
import { ListTable, FilterChips, Pagination } from "../components/common";
import { formatDate } from "../utils/format";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Active", value: "Active" },
  { label: "Disabled", value: "Disabled" },
];

const discountLabel = (rule) => {
  if (rule.price_or_product_discount === "Product") return "Free item";
  if (rule.rate_or_discount === "Discount Percentage") return `${rule.discount_percentage || 0}%`;
  if (rule.rate_or_discount === "Discount Amount") return rule.discount_amount || 0;
  return "—";
};

const DISCOUNT_COLUMNS = [
  {
    key: "title",
    label: "Title",
    width: "1.4fr",
    render: (r) => (
      <div>
        <div>{r.title || r.name}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-faint)" }}>{r.apply_on || "—"}</div>
      </div>
    ),
  },
  {
    key: "discount",
    label: "Discount",
    width: "0.9fr",
    render: (r) => <span>{discountLabel(r)}</span>,
  },
  {
    key: "type",
    label: "Type",
    width: "0.8fr",
    render: (r) => (
      <span className={r.selling ? "pos-badge pos-badge-paid" : "pos-badge"}>
        {r.selling ? "Selling" : r.buying ? "Buying" : "—"}
      </span>
    ),
  },
  {
    key: "priority",
    label: "Priority",
    width: "0.6fr",
    align: "center",
    render: (r) => <span style={{ color: "var(--color-text-muted)" }}>{r.priority || "—"}</span>,
  },
  {
    key: "valid_upto",
    label: "Valid Upto",
    width: "0.9fr",
    render: (r) => <span style={{ color: "var(--color-text-muted)" }}>{r.valid_upto ? formatDate(r.valid_upto) : "—"}</span>,
  },
  {
    key: "disable",
    label: "Status",
    width: "0.8fr",
    render: (r) => (
      <span className={r.disable ? "pos-badge" : "pos-badge pos-badge-paid"}>{r.disable ? "Disabled" : "Active"}</span>
    ),
  },
];

const DiscountListPage = () => {
  const { setTopbar } = useOutletContext();
  const navigate = useNavigate();

  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const [pricingRules, setPricingRules] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadPricingRules = () => {
    setLoading(true);
    fetchPricingRules({ status, search }, page * PAGE_SIZE, PAGE_SIZE).then((data) => {
      setPricingRules(data?.pricingRules ?? []);
      setTotalCount(data?.total_count ?? 0);
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(loadPricingRules, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, search]);

  useEffect(() => {
    setTopbar({
      title: "Discounts",
      searchValue: search,
      onSearchChange: (value) => {
        setPage(0);
        setSearch(value);
      },
      searchPlaceholder: "Search discount title",
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
        <button
          type="button"
          className="pos-btn pos-btn-primary"
          style={{ height: 32, fontSize: "12.5px", padding: "0 14px" }}
          onClick={() => navigate("/posapp/discounts/new")}
        >
          <i className="bi bi-plus-lg" style={{ fontSize: 14 }} />
          New discount
        </button>
      </div>

      <div className="d-flex flex-column flex-fill px-4 pt-3 pb-4" style={{ minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ListTable
            columns={DISCOUNT_COLUMNS}
            rows={pricingRules}
            loading={loading}
            emptyMessage="No discounts found"
            onRowClick={(r) => navigate(`/posapp/discounts/${encodeURIComponent(r.name)}`)}
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

export default DiscountListPage;
