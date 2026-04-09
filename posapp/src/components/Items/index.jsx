import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import "./style.css";
import { fetchItems } from "../../api/Items";
import useVirtualScroll from "../../hooks/VirtualScroll";

const CARD_HEIGHT = 280;
const COLUMNS = 4;

// ── Memoized card (unchanged) ──────────────────────────────────────────────
const ItemCard = memo(({ item, qty, onAdd, onIncrement, onDecrement }) => (
  <div className="card align-items-center text-center overflow-hidden cursor-pointer h-100">
    {item.image ? (
      <img src={item.image} alt={item.item_code} height={100} width={90} />
    ) : (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="90"
        height="100"
        fill="currentColor"
        className="bi bi-shop-window"
        viewBox="0 0 16 16"
      >
        <path d="M2.97 1.35A1 1 0 0 1 3.73 1h8.54a1 1 0 0 1 .76.35l2.609 3.044A1.5 1.5 0 0 1 16 5.37v.255a2.375 2.375 0 0 1-4.25 1.458A2.37 2.37 0 0 1 9.875 8 2.37 2.37 0 0 1 8 7.083 2.37 2.37 0 0 1 6.125 8a2.37 2.37 0 0 1-1.875-.917A2.375 2.375 0 0 1 0 5.625V5.37a1.5 1.5 0 0 1 .361-.976zm1.78 4.275a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 1 0 2.75 0V5.37a.5.5 0 0 0-.12-.325L12.27 2H3.73L1.12 5.045A.5.5 0 0 0 1 5.37v.255a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0M1.5 8.5A.5.5 0 0 1 2 9v6h12V9a.5.5 0 0 1 1 0v6h.5a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1H1V9a.5.5 0 0 1 .5-.5m2 .5a.5.5 0 0 1 .5.5V13h8V9.5a.5.5 0 0 1 1 0V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a.5.5 0 0 1 .5-.5" />
      </svg>
    )}

    <p className="mb-0 mt-0">{item.item_group}</p>
    <p className="mb-0 mt-0">{item.item_code}</p>
    <span className="badge rounded-pill text-bg-primary x-small-text fw-lighter">
      {item.item_name}
    </span>
    <div className="d-flex align-items-center justify-content-between price w-100 px-2 my-3">
      <p className="text-gray-9 mb-0 fw-semibold">₹ {item.rate}</p>
      <div className="d-flex align-items-center gap-2">
        <button
          className="btn btn-sm btn-outline-secondary"
          disabled={qty <= 1}
          onClick={() => onDecrement(item.item_code)}
        >
          −
        </button>
        <span className="fw-semibold">{qty}</span>
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={() => onIncrement(item.item_code)}
        >
          +
        </button>
      </div>
    </div>
  </div>
));

// ── Main component ─────────────────────────────────────────────────────────
const Items = ({ selectedGroup, invoiceDetails, onChangeInvoice }) => {
  const [items, setItems] = useState([]);
  const [itemQty, setItemQty] = useState({});
  const containerRef = useRef(null);

  useEffect(() => {
    fetchItems(selectedGroup).then(setItems);
  }, [selectedGroup]);

  const cartItemMap = useMemo(
    () => new Map(invoiceDetails.items.map((item) => [item.item_code, item])),
    [invoiceDetails.items],
  );

  const addItemToCart = useCallback(
    (item_code, rate) => {
      const qty = itemQty[item_code] ?? 1;
      const existingItem = cartItemMap.get(item_code);

      const updatedItems = existingItem
        ? invoiceDetails.items.map((item) =>
            item.item_code === item_code
              ? {
                  ...item,
                  qty: item.qty + qty,
                  rate,
                  amount: (item.qty + qty) * rate,
                }
              : item,
          )
        : [
            ...invoiceDetails.items,
            { item_code, qty, rate, amount: qty * rate },
          ];

      onChangeInvoice({ ...invoiceDetails, items: updatedItems });
    },
    [itemQty, cartItemMap, invoiceDetails, onChangeInvoice],
  );

  const handleDecrement = useCallback((item_code) => {
    setItemQty((prev) => ({
      ...prev,
      [item_code]: Math.max((prev[item_code] ?? 1) - 1, 1),
    }));
  }, []);

  const handleIncrement = useCallback((item_code) => {
    setItemQty((prev) => ({
      ...prev,
      [item_code]: (prev[item_code] ?? 1) + 1,
    }));
  }, []);

  // Chunk flat list → rows of 4
  const rows = useMemo(() => {
    const result = [];
    for (let i = 0; i < items.length; i += COLUMNS) {
      result.push(items.slice(i, i + COLUMNS));
    }
    return result;
  }, [items]);

  const { visibleRange, totalHeight, onScroll } = useVirtualScroll({
    totalRows: rows.length,
    rowHeight: CARD_HEIGHT,
    containerRef,
  });

  // Only slice the rows that are actually visible
  const visibleRows = rows.slice(visibleRange.start, visibleRange.end + 1);

  return (
    <div className="product-section mx-2 border-0">
      <div className="input-group mb-3 mt-3">
        <span className="input-group-text">
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
        />
      </div>

      {/* Scrollable container */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        style={{
          height: "calc(100vh - 160px)",
          overflowY: "auto",
          position: "relative",
        }}
      >
        {/* Full height spacer — makes the scrollbar reflect actual list size */}
        <div style={{ height: totalHeight, position: "relative" }}>
          {/* Only visible rows are rendered, positioned absolutely */}
          {visibleRows.map((rowItems, i) => {
            const rowIndex = visibleRange.start + i;
            return (
              <div
                key={rowIndex}
                className="row mx-0"
                style={{
                  position: "absolute",
                  top: rowIndex * CARD_HEIGHT, // ← pushes row to correct position
                  width: "100%",
                  height: CARD_HEIGHT,
                }}
              >
                {rowItems.map((item) => (
                  <div className="col-sm-3 p-2" key={item.item_code}>
                    <ItemCard
                      item={item}
                      qty={itemQty[item.item_code] ?? 1}
                      onAdd={addItemToCart}
                      onIncrement={handleIncrement}
                      onDecrement={handleDecrement}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Items;
