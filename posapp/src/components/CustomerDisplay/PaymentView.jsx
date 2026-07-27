const formatAmount = (value, currencySymbol, precision) =>
  `${currencySymbol}${(value ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })}`;

const PaymentView = ({ grandTotal, currencySymbol, precision }) => (
  <div className="customer-display-screen customer-display-payment">
    <i className="bi bi-credit-card-2-front" style={{ fontSize: 64, color: "var(--color-primary)" }} />
    <h2 className="mt-4">Please Pay</h2>
    <div className="customer-display-payment-amount">{formatAmount(grandTotal, currencySymbol, precision)}</div>
  </div>
);

export default PaymentView;
