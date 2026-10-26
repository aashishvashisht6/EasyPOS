import { formatCurrency } from "../../utils/format";
import { useTranslation } from "../../translation";

// currencyFormat ({ symbol, number_format, symbol_on_right }) comes from the
// Terminal's broadcast snapshot (hooks/useCustomerDisplayBroadcaster.js).
const formatAmount = (value, currencyFormat, precision) => formatCurrency(value ?? 0, currencyFormat, precision);

const PaymentView = ({ grandTotal, currencyFormat, precision }) => {
  const { __ } = useTranslation();
  return (
    <div className="customer-display-screen customer-display-payment">
      <i className="bi bi-credit-card-2-front" style={{ fontSize: 64, color: "var(--color-primary)" }} />
      <h2 className="mt-4">{__("Please Pay")}</h2>
      <div className="customer-display-payment-amount">{formatAmount(grandTotal, currencyFormat, precision)}</div>
    </div>
  );
};

export default PaymentView;
