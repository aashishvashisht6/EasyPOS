import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import { fetchItems } from "../../api/Items";
import useVirtualScroll from "../../hooks/VirtualScroll";
import useCartStore from "../../store/cartStore";
import usePOSSessionStore from "../../store/posSessionStore";

const CARD_HEIGHT = 150; // actual card content is ~138.5px tall — must exceed that or virtualized rows overlap
const CARD_MIN_WIDTH = 150; // px, includes gap — drives responsive column count
const GRID_GAP = 10;

// ── Memoized card ───────────────────────────────────────────────────────────
const ItemCard = memo(({ item, qty, inCart, onAdd, onIncrement, onDecrement }) => (
  <div
    className={`pos-item-card ${inCart ? "in-cart" : ""}`}
    onClick={() => onAdd(item)}
  >
    {inCart && (
      <div className="pos-item-check-badge">
        <i className="bi bi-check" />
      </div>
    )}

    <div className="pos-item-icon">
      {item.image ? <img src={item.image} alt={item.item_code} /> : <i className="bi bi-box-seam" />}
    </div>

    <div className="pos-item-name" title={item.item_name || item.item_code}>
      {item.item_name || item.item_code}
    </div>
    <div className="pos-item-price">₹{item.rate}</div>

    <div className="pos-item-stepper">
      <button
        type="button"
        disabled={qty <= 1}
        onClick={(e) => { e.stopPropagation(); onDecrement(item.item_code); }}
      >
        −
      </button>
      <span>{qty}</span>
      <button type="button" onClick={(e) => { e.stopPropagation(); onIncrement(item.item_code); }}>
        +
      </button>
    </div>
  </div>
));

// ── Main component ─────────────────────────────────────────────────────────
const Items = ({ selectedGroup, searchText = "" }) => {
  const [items, setItems] = useState([]);
  const [itemQty, setItemQty] = useState({});
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef(null);
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const updateItemQtyByCode = useCartStore((s) => s.updateItemQtyByCode);
  const hasOpeningEntry = usePOSSessionStore((s) => s.hasOpeningEntry);
  const openOpeningModal = usePOSSessionStore((s) => s.openOpeningModal);

  useEffect(() => {
    fetchItems(selectedGroup).then(setItems);
  }, [selectedGroup]);

  // Track panel width so the grid adapts across tablet/laptop/desktop instead
  // of squeezing a fixed column count into whatever space the Cart leaves it.
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const columns = useMemo(() => {
    if (!containerWidth) return 4;
    return Math.max(2, Math.min(8, Math.floor((containerWidth + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP))));
  }, [containerWidth]);

  const cartQtyByCode = useMemo(
    () => new Map(cartItems.map((item) => [item.item_code, item.qty])),
    [cartItems],
  );
  const cartCodes = useMemo(() => new Set(cartQtyByCode.keys()), [cartQtyByCode]);

  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (item) =>
        item.item_code?.toLowerCase().includes(query) ||
        item.item_name?.toLowerCase().includes(query),
    );
  }, [items, searchText]);

  const addItemToCart = useCallback(
    (item) => {
      if (!hasOpeningEntry) {
        openOpeningModal();
        return;
      }
      const qty = itemQty[item.item_code] ?? 1;
      addItem(item.item_code, item.rate, qty, {
        has_serial_no: item.has_serial_no,
        has_batch_no: item.has_batch_no,
      });
    },
    [itemQty, addItem, hasOpeningEntry, openOpeningModal],
  );

  const handleDecrement = useCallback((item_code) => {
    if (cartQtyByCode.has(item_code)) {
      updateItemQtyByCode(item_code, cartQtyByCode.get(item_code) - 1);
      return;
    }
    setItemQty((prev) => ({
      ...prev,
      [item_code]: Math.max((prev[item_code] ?? 1) - 1, 1),
    }));
  }, [cartQtyByCode, updateItemQtyByCode]);

  const handleIncrement = useCallback((item_code) => {
    if (cartQtyByCode.has(item_code)) {
      updateItemQtyByCode(item_code, cartQtyByCode.get(item_code) + 1);
      return;
    }
    setItemQty((prev) => ({
      ...prev,
      [item_code]: (prev[item_code] ?? 1) + 1,
    }));
  }, [cartQtyByCode, updateItemQtyByCode]);

  // Chunk flat list → rows of `columns`
  const rows = useMemo(() => {
    const result = [];
    for (let i = 0; i < filteredItems.length; i += columns) {
      result.push(filteredItems.slice(i, i + columns));
    }
    return result;
  }, [filteredItems, columns]);

  const { visibleRange, totalHeight, onScroll } = useVirtualScroll({
    totalRows: rows.length,
    rowHeight: CARD_HEIGHT,
    containerRef,
  });

  const visibleRows = rows.slice(visibleRange.start, visibleRange.end + 1);

  return (
    <div
      className="pos-card"
      style={{ flex: 1, padding: 14, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      <div
        ref={containerRef}
        onScroll={onScroll}
        style={{ flex: 1, overflowY: "auto", position: "relative", minHeight: 0 }}
      >
        {filteredItems.length === 0 ? (
          <div className="d-flex flex-column align-items-center justify-content-center text-muted gap-2 h-100">
            <i className="bi bi-box-seam" style={{ fontSize: 30, opacity: 0.25 }} />
            <span style={{ fontSize: 13 }}>
              {searchText ? "No items match your search" : "No items in this category"}
            </span>
          </div>
        ) : (
        <div style={{ height: totalHeight, position: "relative" }}>
          {visibleRows.map((rowItems, i) => {
            const rowIndex = visibleRange.start + i;
            return (
              <div
                key={rowIndex}
                style={{
                  position: "absolute",
                  top: rowIndex * CARD_HEIGHT,
                  width: "100%",
                  height: CARD_HEIGHT,
                  display: "grid",
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                  gap: GRID_GAP,
                }}
              >
                {rowItems.map((item) => (
                  <ItemCard
                    key={item.item_code}
                    item={item}
                    qty={cartQtyByCode.get(item.item_code) ?? itemQty[item.item_code] ?? 1}
                    inCart={cartCodes.has(item.item_code)}
                    onAdd={addItemToCart}
                    onIncrement={handleIncrement}
                    onDecrement={handleDecrement}
                  />
                ))}
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
};

export default Items;
