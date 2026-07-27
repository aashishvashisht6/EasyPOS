const formatAmount = (value, currencySymbol, precision) =>
  `${currencySymbol}${(value ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })}`;

const ThankYouScreen = ({ complete, currencySymbol, precision }) => (
  <div className="customer-display-screen customer-display-thank-you">
    <i className="bi bi-check-circle-fill" style={{ fontSize: 72, color: "var(--color-success-icon)" }} />
    <h1 className="mt-4">Thank You!</h1>
    <div className="customer-display-totals customer-display-totals-narrow">
      <div className="customer-display-total-row">
        <span>Amount Paid</span>
        <span>{formatAmount(complete.amountPaid, currencySymbol, precision)}</span>
      </div>
      {complete.changeDue > 0 && (
        <div className="customer-display-total-row">
          <span>Change Due</span>
          <span>{formatAmount(complete.changeDue, currencySymbol, precision)}</span>
        </div>
      )}
      <div className="customer-display-grand-total">
        <span>Total</span>
        <span>{formatAmount(complete.grandTotal, currencySymbol, precision)}</span>
      </div>
    </div>
  </div>
);

export default ThankYouScreen;
