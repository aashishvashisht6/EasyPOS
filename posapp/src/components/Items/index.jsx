import { useEffect, useState } from "react";
import "./style.css";
import { fetchItems } from "../../api/Items";

const Items = ({ selectedGroup, invoiceDetails, onChangeInvoice }) => {
  const [items, setItems] = useState([]);
  const [itemQty, setItemQty] = useState({});

  const getItems = () => {
    fetchItems(selectedGroup).then((data) => {
      setItems(data);
    });
  };

  useEffect(() => {
    getItems();
  }, [selectedGroup]);

  const addItemToCart = (item_code, rate) => {
    const qty = itemQty[item_code] ?? 1;

    const existingItem = invoiceDetails.items.find(
      (item) => item.item_code === item_code,
    );

    let items;

    if (existingItem) {
      items = invoiceDetails.items.map((item) =>
        item.item_code === item_code
          ? {
              ...item,
              qty: item.qty + qty,
              rate,
              amount: (item.qty + qty) * rate,
            }
          : item,
      );
    } else {
      items = [
        ...invoiceDetails.items,
        {
          item_code,
          qty,
          rate,
          amount: qty * rate,
        },
      ];
    }

    onChangeInvoice({ ...invoiceDetails, items });
  };

  return (
    <div className="product-section mx-2 border-0">
      <div className="input-group mb-3 mt-3">
        <span className="input-group-text" id="basic-addon1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            className="bi bi-search"
            viewBox="0 0 16 16"
          >
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
          </svg>
        </span>
        <input
          type="text"
          className="form-control"
          placeholder="Search Item Code, Item Name, Batch & Serial No"
          aria-label="Username"
          aria-describedby="basic-addon1"
        />
      </div>

      {/* Item cards */}
      <div className="row">
        {items.length > 0 &&
          items.map((row) => {
            return (
              <div className="col-sm-3 mt-3" key={row.item_code}>
                <div className="card align-items-center text-center overflow-hidden cursor-pointer">
                  <img
                    src={row.image}
                    alt={row.item_code}
                    height={130}
                    width={120}
                    onClick={() => addItemToCart(row.item_code, row.rate)}
                  />
                  <p className="mb-0 mt-0">{row.item_group}</p>
                  <p className="mb-0 mt-0">{row.item_code}</p>
                  <span className="badge rounded-pill text-bg-primary x-small-text fw-lighter">
                    {row.item_name}
                  </span>

                  <div className="d-flex align-items-center justify-content-between price w-100 px-2 my-3">
                    <p className="text-gray-9 mb-0 fw-semibold">₹ {row.rate}</p>

                    <div className="d-flex align-items-center gap-2">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        disabled={
                          itemQty?.[row.item_code]
                            ? itemQty?.[row.item_code] <= 0
                            : 0
                        }
                        onClick={() => {
                          setItemQty({
                            ...itemQty,
                            [row.item_code]: itemQty?.[row.item_code]
                              ? itemQty[row.item_code] - 1
                              : 0,
                          });
                        }}
                      >
                        −
                      </button>

                      <span className="fw-semibold">
                        {itemQty?.[row.item_code]
                          ? itemQty?.[row.item_code]
                          : 1}
                      </span>

                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => {
                          setItemQty({
                            ...itemQty,
                            [row.item_code]: itemQty?.[row.item_code]
                              ? itemQty[row.item_code] + 1
                              : 2,
                          });
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default Items;
