import { useEffect, useState } from "react";
import { fetchItemGroups } from "../../api/ItemGroup";

const ItemGroup = ({ selectedGroup, onChangeGroup }) => {
  const [itemGroups, setItemGroups] = useState([]);

  useEffect(() => {
    fetchItemGroups().then((data) => setItemGroups(data ?? []));
  }, []);

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
