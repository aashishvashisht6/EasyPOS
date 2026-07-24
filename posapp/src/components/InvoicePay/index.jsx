import { useEffect, useState } from "react";
import "./style.css";
import { postPaymentInvoice } from "../../api/Invoice";
import { fetchProfile } from "../../api/POSProfile";
import usePOSSessionStore from "../../store/posSessionStore";
import useCartStore from "../../store/cartStore";
import { Modal, CurrencyField } from "../common";
import { roundCurrency } from "../../utils/number";

const InvoicePay = ({ onClose, grandTotal, taxes }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [paymentModes, setPaymentModes] = useState([]);
  const [loadingModes, setLoadingModes] = useState(true);
  const openingDetail = usePOSSessionStore((s) => s.openingDetail);
  const currencySymbol = usePOSSessionStore((s) => s.currencySymbol);
  const currencyPrecision = usePOSSessionStore((s) => s.currencyPrecision);
  const floatPrecision = usePOSSessionStore((s) => s.floatPrecision);

  useEffect(() => {
    fetchProfile(openingDetail.pos_profile).then((data) => {
      setPaymentModes(data?.payments ?? []);
      setLoadingModes(false);
    });
  }, [openingDetail.pos_profile]);

  const customer = useCartStore((s) => s.customer);
  const items = useCartStore((s) => s.items);
  const payments = useCartStore((s) => s.payments);
  const salesInvoiceName = useCartStore((s) => s.salesInvoiceName);
  const discountOn = useCartStore((s) => s.discountOn);
  const discountPercentage = useCartStore((s) => s.discountPercentage);
  const updatePayment = useCartStore((s) => s.updatePayment);
  const resetCart = useCartStore((s) => s.resetCart);

  const paidAmount = roundCurrency(
    payments.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0),
    currencyPrecision,
  );
  const balanceDue = roundCurrency(grandTotal - paidAmount, currencyPrecision);

  const formatAmount = (value) =>
    `${currencySymbol}${(value ?? 0).toLocaleString("en-IN", {
      minimumFractionDigits: currencyPrecision,
      maximumFractionDigits: currencyPrecision,
    })}`;

  const getPaymentAmount = (mode_of_payment) =>
    payments.find((row) => row.mode_of_payment === mode_of_payment)?.amount ?? "";

  const createPaymentInvoice = () => {
    if (!customer) {
      setError("Please select a customer");
      return;
    }
    if (items.length < 1) {
      setError("Please add one or more items to the cart");
      return;
    }
    if (payments.length < 1 || paidAmount <= 0) {
      setError("Please enter an amount for at least one payment mode");
      return;
    }
    setError("");
    setSubmitting(true);
    const cleanItems = items.map(
      ({ item_code, qty, rate, amount, serial_no, batch_no, discount_amount, item_tax_template }) => ({
        item_code, qty, rate, amount, serial_no, batch_no, discount_amount, item_tax_template,
      }),
    );
    postPaymentInvoice(
      {
        customer,
        items: cleanItems,
        payments,
        sales_invoice: salesInvoiceName,
        apply_discount_on: discountOn || undefined,
        additional_discount_percentage: roundCurrency(parseFloat(discountPercentage) || 0, floatPrecision),
        taxes,
      },
      openingDetail,
      1,
    ).then((data) => {
      setSubmitting(false);
      if (data?.name) {
        resetCart();
        onClose();
      } else {
        setError("Failed to complete payment");
      }
    });
  };

  return (
    <Modal
      title="Take Payment"
      subtitle="Enter the amount received for each payment mode."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="pos-btn pos-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="pos-btn pos-btn-primary"
            onClick={createPaymentInvoice}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" />
                Submitting…
              </>
            ) : (
              "Complete Payment"
            )}
          </button>
        </>
      }
    >
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="invoice-pay-pill mb-3">
        <span className="invoice-pay-pill-label">Grand Total</span>
        <span className="invoice-pay-pill-value">{formatAmount(grandTotal)}</span>
      </div>

      <label className="pos-field-label">Payment Summary</label>

      {loadingModes ? (
        <div className="text-center py-3">
          <span className="spinner-border spinner-border-sm" role="status" />
        </div>
      ) : paymentModes.length === 0 ? (
        <div className="text-muted text-center py-3" style={{ fontSize: 13 }}>
          No payment modes configured for this POS Profile.
        </div>
      ) : (
        <div className="invoice-pay-rows mb-3">
          {paymentModes.map((row) => (
            <div className="invoice-pay-row" key={row.mode_of_payment}>
              <div className="invoice-pay-row-label">{row.mode_of_payment}</div>
              <div className="invoice-pay-row-field">
                <CurrencyField
                  className="mb-0"
                  placeholder="0"
                  min={0}
                  value={getPaymentAmount(row.mode_of_payment)}
                  onChange={(value) => updatePayment(row.mode_of_payment, value === "" ? 0 : value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="invoice-pay-summary">
        <div>
          <div className="invoice-pay-figure-label">Paid Amount</div>
          <div className="invoice-pay-figure-value">{formatAmount(paidAmount)}</div>
        </div>
        <div>
          <div className="invoice-pay-figure-label">{balanceDue > 0 ? "Balance Due" : "Change to Return"}</div>
          <div
            className="invoice-pay-figure-value"
            style={{
              color:
                balanceDue > 0
                  ? "var(--color-danger-text)"
                  : balanceDue < 0
                  ? "var(--color-success-text)"
                  : "var(--color-text-secondary)",
            }}
          >
            {formatAmount(Math.abs(balanceDue))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default InvoicePay;
