import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import ItemGroup from "../components/ItemGroup";
import Items from "../components/Items";
import Cart from "../components/Cart";
import CartBar from "../components/Cart/CartBar";
import useIsMobile from "../hooks/useIsMobile";
import OpeningEntryModal from "../components/Opening/OpeningEntryModal";
import useBarcodeScanner from "../hooks/useBarcodeScanner";
import useKeyboardShortcuts from "../hooks/useKeyboardShortcuts";
import ShortcutsModal from "../components/Shortcuts/ShortcutsModal";
import { SHORTCUT_TARGETS, focusShortcutTarget } from "../utils/keyboardShortcuts";
import { BarcodeScannerModal } from "../components/common";
import useConnectivityStore from "../engine/connectivity";
import useEngineSettingsStore from "../engine/settingsStore";
import { useTranslation } from "../translation";

const POSTerminalPage = () => {
  const { __ } = useTranslation();
  const { setTopbar } = useOutletContext();
  const [activeItemGroup, setActiveItemGroup] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const isMobile = useIsMobile();
  const [cartOpen, setCartOpen] = useState(false);
  const offlineModeEnabled = useEngineSettingsStore((s) => s.offlineModeEnabled);
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const showOfflineBanner = offlineModeEnabled && !isOnline;

  const handleCameraDetected = useCallback((code) => {
    setShowCameraScanner(false);
    setSearchText(code);
  }, []);

  useEffect(() => {
    setTopbar({
      title: __("POS Terminal"),
      searchValue: searchText,
      onSearchChange: setSearchText,
      searchPlaceholder: __("Scan barcode/serial/batch or search items"),
      onScanClick: () => setShowCameraScanner(true),
    });
  }, [searchText, setTopbar, __]);

  // Lets a cashier scan straight into the item grid without clicking the
  // search box first — feeds the scanned code through the same searchText
  // state the box uses, so it goes through Items' existing debounce/auto-add
  // flow (see AUTO_ADD_MATCH_TYPES in components/Items) with no duplicated logic.
  useBarcodeScanner({ onScan: setSearchText, enabled: !showCameraScanner });

  // Page-level shortcuts; the cart's own (pay, void last line, discount) are
  // registered in components/Cart, which owns that state.
  useKeyboardShortcuts({
    handlers: {
      focusSearch: () => focusShortcutTarget(SHORTCUT_TARGETS.itemSearch),
      showHelp: () => setShowShortcuts(true),
    },
  });
  // Derived so that leaving the phone layout (rotate/resize) can't leave the sheet "open".
  const sheetOpen = isMobile && cartOpen;

  useEffect(() => {
    if (!sheetOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setCartOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  return (
    <>
      {showOfflineBanner && (
        <div
          className="d-flex align-items-center"
          style={{
            margin: "12px 16px 0",
            padding: "8px 14px",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-danger-bg)",
            color: "var(--color-danger-text)",
            fontSize: 12.5,
            gap: 8,
            flexShrink: 0,
          }}
        >
          <i className="bi bi-cloud-slash" />
          {__("Offline — showing cached catalog and pricing. Sales ring up and sync automatically once reconnected.")}
        </div>
      )}

      <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
        <ItemGroup selectedGroup={activeItemGroup} onChangeGroup={setActiveItemGroup} />
      </div>

      <div className="pos-terminal-body">
        <Items
          selectedGroup={activeItemGroup}
          searchText={searchText}
          onSearchResolved={() => setSearchText("")}
        />

        {/* Phones: this wrapper becomes a bottom sheet (CSS, .pos-cart-sheet);
            Cart stays mounted so its pricing/loyalty effects and in-progress
            state survive opening and closing the sheet. Elsewhere it is
            display: contents, i.e. Cart is a plain flex child as before. */}
        {sheetOpen && <div className="pos-cart-sheet-backdrop" onClick={() => setCartOpen(false)} />}
        <div className={`pos-cart-sheet${sheetOpen ? " open" : ""}`} aria-hidden={isMobile && !sheetOpen}>
          <div className="pos-cart-sheet-head">
            <span className="pos-sheet-handle" aria-hidden="true" />
            <button
              type="button"
              className="pos-icon-btn"
              aria-label={__("Close cart")}
              onClick={() => setCartOpen(false)}
            >
              <i className="bi bi-chevron-down" />
            </button>
          </div>
          <Cart onSaleComplete={() => setCartOpen(false)} />
        </div>
      </div>

      {isMobile && <CartBar onOpen={() => setCartOpen(true)} />}

      <OpeningEntryModal />

      <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      <BarcodeScannerModal
        open={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onDetected={handleCameraDetected}
        subtitle={__("Populates the item search field, same as a hardware scanner")}
      />
    </>
  );
};

export default POSTerminalPage;
