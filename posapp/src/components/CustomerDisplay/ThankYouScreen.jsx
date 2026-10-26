import { formatCurrency } from "../../utils/format";
import { useTranslation } from "../../translation";

// currencyFormat ({ symbol, number_format, symbol_on_right }) comes from the
// Terminal's broadcast snapshot (hooks/useCustomerDisplayBroadcaster.js).
const formatAmount = (value, currencyFormat, precision) => formatCurrency(value ?? 0, currencyFormat, precision);

const ThankYouScreen = ({ complete, currencyFormat, precision }) => {
  const { __ } = useTranslation();
  return (
    <div className="customer-display-screen customer-display-thank-you">
      <i className="bi bi-check-circle-fill" style={{ fontSize: 72, color: "var(--color-success-icon)" }} />
      <h1 className="mt-4">{__("Thank You!")}</h1>
      <div className="customer-display-totals customer-display-totals-narrow">
        <div className="customer-display-total-row">
          <span>{__("Amount Paid")}</span>
          <span>{formatAmount(complete.amountPaid, currencyFormat, precision)}</span>
        </div>
        {complete.changeDue > 0 && (
          <div className="customer-display-total-row">
            <span>{__("Change Due")}</span>
            <span>{formatAmount(complete.changeDue, currencyFormat, precision)}</span>
          </div>
        )}
        <div className="customer-display-grand-total">
          <span>{__("Total")}</span>
          <span>{formatAmount(complete.grandTotal, currencyFormat, precision)}</span>
        </div>
      </div>
    </div>
  );
};

export default ThankYouScreen;
