import { useTranslation } from "../../translation";
import useCurrencyFormatter from "../../hooks/useCurrencyFormatter";
import useCartStore from "../../store/cartStore";
import useCartTotals from "../../hooks/useCartTotals";

// Phone-only summary strip under the item grid: keeps the running total in
// view while browsing and opens the cart sheet (see POSTerminalPage).
const CartBar = ({ onOpen }) => {
  const { __ } = useTranslation();
  const money = useCurrencyFormatter();
  const itemCount = useCartStore((s) => s.items.length);
  const { grandTotal } = useCartTotals();

  return (
    <button type="button" className="pos-cart-bar" onClick={onOpen} aria-haspopup="dialog">
      <span className="pos-cart-bar-count">
        <i className="bi bi-cart3" />
        <span className="pos-cart-bar-badge">{itemCount}</span>
      </span>
      <span className="pos-cart-bar-label">{__("View cart")}</span>
      <span className="pos-cart-bar-total">{money(grandTotal)}</span>
      <i className="bi bi-chevron-up" />
    </button>
  );
};

export default CartBar;
