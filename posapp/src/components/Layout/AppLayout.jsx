import { useState, useCallback } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../Sidebar";
import Topbar from "../Topbar";

const DEFAULT_TOPBAR = {
  title: "",
  searchValue: undefined,
  onSearchChange: undefined,
  searchPlaceholder: undefined,
  onScanClick: undefined,
};

// Persistent app shell: Sidebar + Topbar stay mounted across route changes,
// only the routed page (via Outlet) swaps in the content area below. Pages
// customize the Topbar (title/search) through the outlet context's setTopbar.
const AppLayout = () => {
  const [topbar, setTopbarState] = useState(DEFAULT_TOPBAR);

  const setTopbar = useCallback((next) => {
    setTopbarState({ ...DEFAULT_TOPBAR, ...next });
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "var(--color-bg)",
          minWidth: 0,
          height: "100%",
          overflow: "hidden",
        }}
      >
        <Topbar
          title={topbar.title}
          searchValue={topbar.searchValue}
          onSearchChange={topbar.onSearchChange}
          searchPlaceholder={topbar.searchPlaceholder}
          onScanClick={topbar.onScanClick}
        />

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <Outlet context={{ setTopbar }} />
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
