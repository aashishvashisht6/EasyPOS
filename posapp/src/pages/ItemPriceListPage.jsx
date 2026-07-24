import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { fetchItemPrices, fetchPriceListOptions } from "../api/ItemPrice";
import { ListTable, FilterChips, Pagination, SelectField } from "../components/common";
import { formatDate } from "../utils/format";

const PAGE_SIZE = 20;

const TYPE_FILTERS = [
  { label: "All", value: "" },
  { label: "Selling", value: "Selling" },
  { label: "Buying", value: "Buying" },
];

const ITEM_PRICE_COLUMNS = [
  {
    key: "item_code",
    label: "Item",
    width: "1.4fr",
    render: (p) => (
      <div>
        <div>{p.item_name || p.item_code}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-faint)" }}>{p.item_code}</div>
      </div>
    ),
  },
  {
    key: "price_list",
    label: "Price List",
    width: "1fr",
    render: (p) => <span style={{ color: "var(--color-text-muted)" }}>{p.price_list || "—"}</span>,
  },
  {
    key: "price_list_rate",
    label: "Rate",
    width: "0.8fr",
    align: "end",
    render: (p) => (
      <span>
        {p.price_list_rate != null ? Number(p.price_list_rate).toFixed(2) : "—"} {p.currency || ""}
      </span>
    ),
  },
  {
    key: "uom",
    label: "UOM",
    width: "0.7fr",
    render: (p) => <span style={{ color: "var(--color-text-muted)" }}>{p.uom || "—"}</span>,
  },
  {
    key: "type",
    label: "Type",
    width: "0.8fr",
    render: (p) => (
      <span className={p.selling ? "pos-badge pos-badge-paid" : "pos-badge"}>
        {p.selling ? "Selling" : p.buying ? "Buying" : "—"}
      </span>
    ),
  },
  {
    key: "valid_upto",
    label: "Valid Upto",
    width: "0.9fr",
    render: (p) => <span style={{ color: "var(--color-text-muted)" }}>{p.valid_upto ? formatDate(p.valid_upto) : "—"}</span>,
  },
];

const ItemPriceListPage = () => {
  const { setTopbar } = useOutletContext();
  const navigate = useNavigate();

  const [type, setType] = useState("");
  const [priceList, setPriceList] = useState("");
  const [search, setSearch] = useState("");

  const [priceListOptions, setPriceListOptions] = useState([]);

  const [itemPrices, setItemPrices] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPriceListOptions().then((data) => setPriceListOptions(data ?? []));
  }, []);

  const loadItemPrices = () => {
    setLoading(true);
    fetchItemPrices({ selling: type, price_list: priceList, search }, page * PAGE_SIZE, PAGE_SIZE).then((data) => {
      setItemPrices(data?.itemPrices ?? []);
      setTotalCount(data?.total_count ?? 0);
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(loadItemPrices, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, type, priceList, search]);

  useEffect(() => {
    setTopbar({
      title: "Item Prices",
      searchValue: search,
      onSearchChange: (value) => {
        setPage(0);
        setSearch(value);
      },
      searchPlaceholder: "Search item code or name",
    });
  }, [setTopbar, search]);

  const resetToFirstPage = (setter) => (value) => {
    setPage(0);
    setter(value);
  };

  const clearFilters = () => {
    setPage(0);
    setPriceList("");
  };

  const hasActiveFilters = Boolean(priceList);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="d-flex flex-column flex-fill" style={{ minHeight: 0 }}>
      <div className="d-flex align-items-center justify-content-between px-4 pt-3">
        <FilterChips options={TYPE_FILTERS} value={type} onChange={resetToFirstPage(setType)} />
        <Link
          to="/posapp/item-price/new"
          className="pos-btn pos-btn-primary"
          style={{ height: 32, fontSize: "12.5px", padding: "0 14px" }}
        >
          <i className="bi bi-plus-lg" style={{ fontSize: 14 }} />
          New item price
        </Link>
      </div>

      <div className="px-4 pt-3">
        <div className="d-flex align-items-end gap-2">
          <div style={{ width: 220 }}>
            <SelectField
              label="Price List"
              placeholder="All price lists"
              value={priceList}
              onChange={resetToFirstPage(setPriceList)}
              options={priceListOptions.map((pl) => ({ label: pl.name, value: pl.name }))}
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
            columns={ITEM_PRICE_COLUMNS}
            rows={itemPrices}
            loading={loading}
            emptyMessage="No item prices found"
            onRowClick={(p) => navigate(`/posapp/item-price/${encodeURIComponent(p.name)}`)}
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

export default ItemPriceListPage;
