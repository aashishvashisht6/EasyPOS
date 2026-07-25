import { useEffect, useState, useMemo } from "react";
import { fetchItemGroups } from "../../api/ItemGroup";
import usePOSSessionStore from "../../store/posSessionStore";

const ItemGroup = ({ selectedGroup, onChangeGroup }) => {
  const [allItemGroups, setAllItemGroups] = useState([]);
  // POS Profile item_groups restriction (PP-04) — empty = unrestricted.
  const allowedGroups = usePOSSessionStore((s) => s.itemGroups);

  useEffect(() => {
    fetchItemGroups().then((data) => setAllItemGroups(data ?? []));
  }, []);

  const itemGroups = useMemo(
    () =>
      allowedGroups.length
        ? allItemGroups.filter((row) => allowedGroups.includes(row.item_group))
        : allItemGroups,
    [allItemGroups, allowedGroups],
  );

  // If the currently selected category falls outside a newly-applied
  // restriction, fall back to "All" (which itself is already group-restricted
  // server-side via get_items/search_item's pos_profile param).
  useEffect(() => {
    if (selectedGroup && allowedGroups.length && !allowedGroups.includes(selectedGroup)) {
      onChangeGroup("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedGroups, selectedGroup]);

  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
      <div
        className={`pos-category-chip ${selectedGroup === "" ? "active" : ""}`}
        onClick={() => onChangeGroup("")}
      >
        <i className="bi bi-grid" />
        <span>All</span>
      </div>

      {itemGroups.map((row) => (
        <div
          key={row.item_group}
          className={`pos-category-chip ${selectedGroup === row.item_group ? "active" : ""}`}
          onClick={() => onChangeGroup(row.item_group)}
        >
          {row.image ? (
            <img src={row.image} alt={row.item_group} width={16} height={16} style={{ objectFit: "cover", borderRadius: 4 }} />
          ) : (
            <i className="bi bi-tag" />
          )}
          <span>{row.item_group}</span>
        </div>
      ))}
    </div>
  );
};

export default ItemGroup;
