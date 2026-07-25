import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import ItemGroup from "../components/ItemGroup";
import Items from "../components/Items";
import Cart from "../components/Cart";
import OpeningEntryModal from "../components/Opening/OpeningEntryModal";
import useBarcodeScanner from "../hooks/useBarcodeScanner";
import { BarcodeScannerModal } from "../components/common";

const POSTerminalPage = () => {
  const { setTopbar } = useOutletContext();
  const [activeItemGroup, setActiveItemGroup] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  const handleCameraDetected = useCallback((code) => {
    setShowCameraScanner(false);
    setSearchText(code);
  }, []);

  useEffect(() => {
    setTopbar({
      title: "POS Terminal",
      searchValue: searchText,
      onSearchChange: setSearchText,
      searchPlaceholder: "Scan barcode/serial/batch or search items",
      onScanClick: () => setShowCameraScanner(true),
    });
  }, [searchText, setTopbar]);

  // Lets a cashier scan straight into the item grid without clicking the
  // search box first — feeds the scanned code through the same searchText
  // state the box uses, so it goes through Items' existing debounce/auto-add
  // flow (see AUTO_ADD_MATCH_TYPES in components/Items) with no duplicated logic.
  useBarcodeScanner({ onScan: setSearchText, enabled: !showCameraScanner });

  return (
    <>
      <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
        <ItemGroup selectedGroup={activeItemGroup} onChangeGroup={setActiveItemGroup} />
      </div>

      <div style={{ flex: 1, display: "flex", padding: "12px 16px 16px", gap: 16, minHeight: 0 }}>
        <Items
          selectedGroup={activeItemGroup}
          searchText={searchText}
          onSearchResolved={() => setSearchText("")}
        />
        <Cart />
      </div>

      <OpeningEntryModal />

      <BarcodeScannerModal
        open={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onDetected={handleCameraDetected}
        subtitle="Populates the item search field, same as a hardware scanner"
      />
    </>
  );
};

export default POSTerminalPage;
