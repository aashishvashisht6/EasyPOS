import { formatCurrency } from "../../utils/format";
import { useTranslation } from "../../translation";

// currencyFormat ({ symbol, number_format, symbol_on_right }) comes from the
// Terminal's broadcast snapshot (hooks/useCustomerDisplayBroadcaster.js).
const formatAmount = (value, currencyFormat, precision) => formatCurrency(value ?? 0, currencyFormat, precision);

// Mirrors the numbers Cart itself computes/shows (see
// hooks/useCustomerDisplayBroadcaster.js) — this component only renders the
// snapshot it's handed, at kiosk-readable font sizes.
const CartView = ({ snapshot }) => {
  const { __ } = useTranslation();
  const { items, netTotal, taxRows, discountAmount, grandTotal, currencyFormat, precision } = snapshot;

  return (
    <div className="customer-display-screen customer-display-cart">
      <div className="customer-display-items">
        {items.map((item, idx) => (
          <div className="customer-display-item-row" key={`${item.item_code}-${idx}`}>
            <div className="customer-display-item-name" dir="auto">{item.item_code}</div>
            <div className="customer-display-item-qty">× {item.qty}</div>
            <div className="customer-display-item-amount">{formatAmount(item.amount, currencyFormat, precision)}</div>
          </div>
        ))}
      </div>

      <div className="customer-display-totals">
        <div className="customer-display-total-row">
          <span>{__("Subtotal")}</span>
          <span>{formatAmount(netTotal, currencyFormat, precision)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="customer-display-total-row">
            <span>{__("Discount")}</span>
            <span>-{formatAmount(discountAmount, currencyFormat, precision)}</span>
          </div>
        )}
        {taxRows?.map((row) => (
          <div className="customer-display-total-row" key={row.account_head}>
            <span>{row.description || row.account_head}</span>
            <span>{formatAmount(row.tax_amount, currencyFormat, precision)}</span>
          </div>
        ))}
        <div className="customer-display-grand-total">
          <span>{__("Total")}</span>
          <span>{formatAmount(grandTotal, currencyFormat, precision)}</span>
        </div>
      </div>
    </div>
  );
};

export default CartView;
