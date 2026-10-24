const formatAmount = (value, currencySymbol, precision) =>
  `${currencySymbol}${(value ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })}`;

// `splitLabel` ("Bill 2 of 3" / "Payer 1 of 3") is set while paying part of a
// split bill; `partPaid` once that part is paid and the next one is pending.
const PaymentView = ({ grandTotal, currencySymbol, precision, splitLabel, partPaid }) => (
  <div className="customer-display-screen customer-display-payment">
    <i
      className={`bi ${partPaid ? "bi-check-circle-fill" : "bi-credit-card-2-front"}`}
      style={{ fontSize: 64, color: partPaid ? "var(--color-success-icon)" : "var(--color-primary)" }}
    />
    {splitLabel && <div className="customer-display-split-label mt-4">{splitLabel}</div>}
    <h2 className={splitLabel ? "mt-2" : "mt-4"}>{partPaid ? "Paid — thank you!" : "Please Pay"}</h2>
    <div className="customer-display-payment-amount">{formatAmount(grandTotal, currencySymbol, precision)}</div>
  </div>
);

export default PaymentView;
