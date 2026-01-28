import { useEffect, useState } from "react";
import "./style.css"
import { fetchItemGroups } from "../../api/ItemGroup";

const ItemGroup = () => {
  const [itemGroups, setItemGroups] = useState([]);

  const getItemGroups = () => {
    fetchItemGroups().then(data => {
      setItemGroups(data)
    })
  }

  useEffect(() => {
    getItemGroups()
  }, [])

  return (
    <div
      className="sidebar mx-0 d-none d-lg-block"
      style={{ borderRight: "1px solid #E6EAED", width: "9%", maxHeight: "90vh", overflowY: "scroll" }}
    >
      <ul className="d-flex flex-column nav">
        {itemGroups.length > 0 &&
          itemGroups.map((row, idx) => {
            return (
              <li className="nav-item mt-3" key={idx}>
                <div className="card align-items-center text-center item-group-card">
                  <img
                    src={row.image}
                    alt={row.item_code}
                    height={50}
                    width={50}
                  />
                  <p className="mb-0">{row.item_group}</p>
                </div>
              </li>
            );
          })}
      </ul>
    </div>
  );
};

export default ItemGroup;
