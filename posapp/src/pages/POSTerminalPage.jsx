import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import ItemGroup from "../components/ItemGroup";
import Items from "../components/Items";
import Cart from "../components/Cart";
import OpeningEntryModal from "../components/Opening/OpeningEntryModal";

const POSTerminalPage = () => {
  const { setTopbar } = useOutletContext();
  const [activeItemGroup, setActiveItemGroup] = useState("");
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    setTopbar({
      title: "POS Terminal",
      searchValue: searchText,
      onSearchChange: setSearchText,
      searchPlaceholder: "Scan barcode/serial/batch or search items",
    });
  }, [searchText, setTopbar]);

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
    </>
  );
};

export default POSTerminalPage;
