import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { fetchLoyaltyPrograms } from "../api/LoyaltyProgram";
import { ListTable, Pagination } from "../components/common";

const PAGE_SIZE = 20;

const PROGRAM_COLUMNS = [
  {
    key: "loyalty_program_name",
    label: "Program",
    width: "1.6fr",
    render: (p) => (
      <div>
        <div>{p.loyalty_program_name}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-faint)" }}>{p.name}</div>
      </div>
    ),
  },
  {
    key: "loyalty_program_type",
    label: "Type",
    width: "1.1fr",
    render: (p) => <span style={{ color: "var(--color-text-muted)" }}>{p.loyalty_program_type}</span>,
  },
  {
    key: "conversion_factor",
    label: "1 Point =",
    width: "0.8fr",
    align: "end",
    render: (p) => <span>{p.conversion_factor}</span>,
  },
  {
    key: "customer_group",
    label: "Customer Group",
    width: "1fr",
    render: (p) => <span style={{ color: "var(--color-text-muted)" }}>{p.customer_group || "—"}</span>,
  },
  {
    key: "to_date",
    label: "Valid Till",
    width: "0.9fr",
    render: (p) => <span style={{ color: "var(--color-text-muted)" }}>{p.to_date || "—"}</span>,
  },
];

const LoyaltyProgramListPage = () => {
  const { setTopbar } = useOutletContext();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [programs, setPrograms] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadPrograms = () => {
    setLoading(true);
    fetchLoyaltyPrograms({ search }, page * PAGE_SIZE, PAGE_SIZE).then((data) => {
      setPrograms(data?.programs ?? []);
      setTotalCount(data?.total_count ?? 0);
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(loadPrograms, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  useEffect(() => {
    setTopbar({
      title: "Loyalty Programs",
      searchValue: search,
      onSearchChange: (value) => {
        setPage(0);
        setSearch(value);
      },
      searchPlaceholder: "Search program name",
    });
  }, [setTopbar, search]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="d-flex flex-column flex-fill" style={{ minHeight: 0 }}>
      <div className="d-flex align-items-center justify-content-end px-4 pt-3">
        <Link to="/posapp/loyalty-program/new" className="pos-btn pos-btn-primary" style={{ height: 32, fontSize: "12.5px", padding: "0 14px" }}>
          <i className="bi bi-plus-lg" style={{ fontSize: 14 }} />
          New program
        </Link>
      </div>

      <div className="d-flex flex-column flex-fill px-4 pt-3 pb-4" style={{ minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ListTable
            columns={PROGRAM_COLUMNS}
            rows={programs}
            loading={loading}
            emptyMessage="No Loyalty Programs found"
            onRowClick={(p) => navigate(`/posapp/loyalty-program/${encodeURIComponent(p.name)}`)}
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

export default LoyaltyProgramListPage;
