const formatAmount = (value, currencySymbol, precision) =>
  `${currencySymbol}${(value ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })}`;

// Mirrors the numbers Cart itself computes/shows (see
// hooks/useCustomerDisplayBroadcaster.js) — this component only renders the
// snapshot it's handed, at kiosk-readable font sizes.
const CartView = ({ snapshot }) => {
  const { items, netTotal, taxRows, discountAmount, grandTotal, currencySymbol, precision } = snapshot;

  return (
    <div className="customer-display-screen customer-display-cart">
      <div className="customer-display-items">
        {items.map((item, idx) => (
          <div className="customer-display-item-row" key={`${item.item_code}-${idx}`}>
            <div className="customer-display-item-name">{item.item_code}</div>
            <div className="customer-display-item-qty">× {item.qty}</div>
            <div className="customer-display-item-amount">{formatAmount(item.amount, currencySymbol, precision)}</div>
          </div>
        ))}
      </div>

      <div className="customer-display-totals">
        <div className="customer-display-total-row">
          <span>Subtotal</span>
          <span>{formatAmount(netTotal, currencySymbol, precision)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="customer-display-total-row">
            <span>Discount</span>
            <span>-{formatAmount(discountAmount, currencySymbol, precision)}</span>
          </div>
        )}
        {taxRows?.map((row) => (
          <div className="customer-display-total-row" key={row.account_head}>
            <span>{row.description || row.account_head}</span>
            <span>{formatAmount(row.tax_amount, currencySymbol, precision)}</span>
          </div>
        ))}
        <div className="customer-display-grand-total">
          <span>Total</span>
          <span>{formatAmount(grandTotal, currencySymbol, precision)}</span>
        </div>
      </div>
    </div>
  );
};

export default CartView;
