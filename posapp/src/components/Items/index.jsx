import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import { fetchItems, searchItem } from "../../api/Items";
import useVirtualScroll from "../../hooks/VirtualScroll";
import useCartStore from "../../store/cartStore";
import usePOSSessionStore from "../../store/posSessionStore";

const CARD_HEIGHT = 150; // actual card content is ~138.5px tall — must exceed that or virtualized rows overlap
const CARD_MIN_WIDTH = 150; // px, includes gap — drives responsive column count
const GRID_GAP = 10;
const SEARCH_DEBOUNCE_MS = 300;
// Unique-resolution match types: exactly one item, safe to add straight to cart
// without the cashier having to click it (mirrors a physical barcode scanner).
const AUTO_ADD_MATCH_TYPES = new Set(["barcode", "serial_no", "batch_no", "item_code"]);

// ── Memoized card ───────────────────────────────────────────────────────────
// item.stock/item.rate are null until an Opening Entry resolves a warehouse and
// price list (see easy_pos.api.item.get_items) — shown as "—" / no stock badge.
const ItemCard = memo(({ item, qty, inCart, onAdd, onIncrement, onDecrement, currencySymbol }) => {
  const hasStock = item.stock !== null && item.stock !== undefined;
  const outOfStock = hasStock && item.stock <= 0;
  return (
    <div
      className={`pos-item-card ${inCart ? "in-cart" : ""} ${outOfStock ? "out-of-stock" : ""}`}
      onClick={() => { if (!outOfStock) onAdd(item); }}
      aria-disabled={outOfStock}
    >
      {inCart && (
        <div className="pos-item-check-badge">
          <i className="bi bi-check" />
        </div>
      )}

      {item.is_product_bundle && (
        <div className="pos-item-bundle-badge" title="Product Bundle">
          <i className="bi bi-boxes" />
        </div>
      )}

      <div className="pos-item-icon">
        {item.image ? <img src={item.image} alt={item.item_code} /> : <i className="bi bi-box-seam" />}
      </div>

      <div className="pos-item-name" title={item.item_name || item.item_code}>
        {item.item_name || item.item_code}
      </div>

      <div className="pos-item-price-row">
        <span className="pos-item-price">
          {item.rate === null || item.rate === undefined ? "—" : `${currencySymbol}${item.rate}`}
        </span>
        {hasStock && (
          <span className={`pos-item-stock ${outOfStock ? "out" : ""}`}>
            {outOfStock ? "Out of stock" : `${item.stock} left`}
          </span>
        )}
      </div>

      <div className="pos-item-stepper">
        <button
          type="button"
          disabled={qty <= 1 || outOfStock}
          onClick={(e) => { e.stopPropagation(); onDecrement(item.item_code); }}
        >
          −
        </button>
        <span>{qty}</span>
        <button
          type="button"
          disabled={outOfStock}
          onClick={(e) => { e.stopPropagation(); onIncrement(item.item_code); }}
        >
          +
        </button>
      </div>
    </div>
  );
});

// ── Main component ─────────────────────────────────────────────────────────
const Items = ({ selectedGroup, searchText = "", onSearchResolved }) => {
  const [items, setItems] = useState([]);
  const [itemQty, setItemQty] = useState({});
  const [containerWidth, setContainerWidth] = useState(0);
  // null = not searching (show the active category's items); array = backend
  // search results (scanned barcode/serial/batch/item_code, or a name search).
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef(null);
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const updateItemQtyByCode = useCartStore((s) => s.updateItemQtyByCode);
  const hasOpeningEntry = usePOSSessionStore((s) => s.hasOpeningEntry);
  const openOpeningModal = usePOSSessionStore((s) => s.openOpeningModal);
  const warehouse = usePOSSessionStore((s) => s.warehouse);
  const priceList = usePOSSessionStore((s) => s.priceList);
  const posProfile = usePOSSessionStore((s) => s.posProfile);
  const currencySymbol = usePOSSessionStore((s) => s.currencySymbol);
  const currencyPrecision = usePOSSessionStore((s) => s.currencyPrecision);
  const customer = useCartStore((s) => s.customer);

  // Re-fetches once the Opening Entry resolves a warehouse/price list, so items
  // that were showing with no stock/rate pick theirs up without a page reload.
  // Also re-fetches when the cart's customer changes (customer-specific Item
  // Price) or when a POS Profile item_groups restriction narrows the catalog.
  useEffect(() => {
    fetchItems(selectedGroup, warehouse, priceList, customer, posProfile).then(setItems);
  }, [selectedGroup, warehouse, priceList, customer, posProfile]);

  // Debounced backend search — covers item code, name, barcode, serial no and
  // batch no in one call (see easy_pos.api.item.search_item). A scanner types
  // the full code almost instantly, so once it resolves to a single exact
  // match we add it straight to cart instead of making the cashier click it.
  useEffect(() => {
    const query = searchText.trim();
    if (!query) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    let cancelled = false;
    const handle = setTimeout(async () => {
      const result = await searchItem(query, warehouse, priceList, customer, posProfile);
      if (cancelled || !result) return;

      const scannedOutOfStock =
        AUTO_ADD_MATCH_TYPES.has(result.match_type) &&
        result.items.length === 1 &&
        result.items[0].stock !== null &&
        result.items[0].stock !== undefined &&
        result.items[0].stock <= 0;

      if (AUTO_ADD_MATCH_TYPES.has(result.match_type) && result.items.length === 1 && !scannedOutOfStock) {
        const item = result.items[0];
        if (!hasOpeningEntry) {
          openOpeningModal();
        } else {
          addItem(item.item_code, item.rate, 1, {
            has_serial_no: item.has_serial_no,
            has_batch_no: item.has_batch_no,
            serial_no: item.serial_no ?? "",
            batch_no: item.batch_no ?? "",
            item_tax_template: item.item_tax_template,
            item_tax_rate: item.item_tax_rate,
            is_product_bundle: item.is_product_bundle,
          }, currencyPrecision);
        }
        setSearchResults(null);
        setSearching(false);
        onSearchResolved?.();
        return;
      }

      setSearchResults(result.items);
      setSearching(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

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

  const filteredItems = searchResults !== null ? searchResults : items;

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
        item_tax_template: item.item_tax_template,
        item_tax_rate: item.item_tax_rate,
        is_product_bundle: item.is_product_bundle,
      }, currencyPrecision);
    },
    [itemQty, addItem, hasOpeningEntry, openOpeningModal, currencyPrecision],
  );

  const handleDecrement = useCallback((item_code) => {
    if (cartQtyByCode.has(item_code)) {
      updateItemQtyByCode(item_code, cartQtyByCode.get(item_code) - 1, currencyPrecision);
      return;
    }
    setItemQty((prev) => ({
      ...prev,
      [item_code]: Math.max((prev[item_code] ?? 1) - 1, 1),
    }));
  }, [cartQtyByCode, updateItemQtyByCode, currencyPrecision]);

  const handleIncrement = useCallback((item_code) => {
    if (cartQtyByCode.has(item_code)) {
      updateItemQtyByCode(item_code, cartQtyByCode.get(item_code) + 1, currencyPrecision);
      return;
    }
    setItemQty((prev) => ({
      ...prev,
      [item_code]: (prev[item_code] ?? 1) + 1,
    }));
  }, [cartQtyByCode, updateItemQtyByCode, currencyPrecision]);

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
        {searching && filteredItems.length === 0 ? (
          <div className="d-flex flex-column align-items-center justify-content-center text-muted gap-2 h-100">
            <i className="bi bi-arrow-repeat" style={{ fontSize: 30, opacity: 0.25 }} />
            <span style={{ fontSize: 13 }}>Searching…</span>
          </div>
        ) : filteredItems.length === 0 ? (
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
                    currencySymbol={currencySymbol}
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
