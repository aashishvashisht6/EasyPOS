import { useState, useCallback, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../Sidebar";
import Topbar from "../Topbar";
import useIsMobile from "../../hooks/useIsMobile";

// <input> types that never raise the on-screen keyboard
const NON_TEXT_INPUTS = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "image"]);

const raisesKeyboard = (el) =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(el.type)) ||
  el?.isContentEditable === true;

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
  const isMobile = useIsMobile();

  // Phones: flag the document while a text field is focused so CSS can drop the
  // bottom bars and leave the keyboard's remaining space to the form.
  useEffect(() => {
    if (!isMobile) return undefined;
    const root = document.documentElement;
    const onFocusIn = (e) => root.classList.toggle("pos-kb-open", raisesKeyboard(e.target));
    const onFocusOut = () => root.classList.remove("pos-kb-open");
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      root.classList.remove("pos-kb-open");
    };
  }, [isMobile]);

  const setTopbar = useCallback((next) => {
    setTopbarState({ ...DEFAULT_TOPBAR, ...next });
  }, []);

  return (
    <div className="pos-app-shell">
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

        <div className="pos-page-scroll" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <Outlet context={{ setTopbar }} />
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
