import { useState } from "react";
import useIsMobile from "../../hooks/useIsMobile";
import BottomSheet from "./BottomSheet";
import { useTranslation } from "../../translation";

// Column-filter row for list pages. Desktop/tablet: the filters sit inline in
// one row, as before. Phones: they collapse behind a single "Filters" button
// that opens them stacked in a bottom sheet (`active` puts a dot on the
// button when any filter has a value). Children are the same field wrappers
// the pages already render, so filter state and handlers stay in the page.
const FilterBar = ({ active = false, children }) => {
  const { __ } = useTranslation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile) {
    return (
      <div className="px-4 pt-3">
        <div className="d-flex align-items-end gap-2">{children}</div>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 pt-3">
        <button type="button" className="pos-btn pos-btn-secondary w-100" onClick={() => setOpen(true)}>
          <i className="bi bi-funnel me-1" />
          {__("Filters")}
          {active && <span className="pos-filter-dot" aria-label={__("Filters applied")} />}
        </button>
      </div>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={__("Filters")}
        footer={
          <button type="button" className="pos-btn pos-btn-primary w-100" onClick={() => setOpen(false)}>
            {__("Done")}
          </button>
        }
      >
        <div className="pos-filter-sheet">{children}</div>
      </BottomSheet>
    </>
  );
};

export default FilterBar;
