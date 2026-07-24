const Pagination = ({ page, totalPages, onPrev, onNext }) => (
  <div className="d-flex justify-content-between align-items-center">
    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
      Page {page + 1} of {totalPages}
    </span>
    <div className="d-flex gap-2">
      <button
        type="button"
        className="pos-btn pos-btn-secondary"
        style={{ height: 30, fontSize: 12, padding: "0 12px" }}
        disabled={page === 0}
        onClick={onPrev}
      >
        Previous
      </button>
      <button
        type="button"
        className="pos-btn pos-btn-secondary"
        style={{ height: 30, fontSize: 12, padding: "0 12px" }}
        disabled={page + 1 >= totalPages}
        onClick={onNext}
      >
        Next
      </button>
    </div>
  </div>
);

export default Pagination;
