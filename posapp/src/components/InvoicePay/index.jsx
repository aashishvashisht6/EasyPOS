import { useEffect, useState } from "react";
import "./style.css";
import { postPaymentInvoice } from "../../api/Invoice";
import { fetchProfile } from "../../api/POSProfile";
import { fetchPaymentGatewayConfig } from "../../api/Payment";
import { getPaymentGateway } from "../PaymentGateways";
import usePOSSessionStore from "../../store/posSessionStore";
import useCartStore from "../../store/cartStore";
import { Modal, CurrencyField, NumberField, CheckboxField, ErrorAlert } from "../common";
import { roundCurrency } from "../../utils/number";

const InvoicePay = ({ onClose, grandTotal, taxes }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [paymentModes, setPaymentModes] = useState([]);
  const [loadingModes, setLoadingModes] = useState(true);
  const [gatewayConfig, setGatewayConfig] = useState(null);
  const openingDetail = usePOSSessionStore((s) => s.openingDetail);
  const currencySymbol = usePOSSessionStore((s) => s.currencySymbol);
  const currencyPrecision = usePOSSessionStore((s) => s.currencyPrecision);
  const floatPrecision = usePOSSessionStore((s) => s.floatPrecision);
  const printReceiptOnOrderComplete = usePOSSessionStore((s) => s.printReceiptOnOrderComplete);
  const printFormat = usePOSSessionStore((s) => s.printFormat);

  useEffect(() => {
    fetchProfile(openingDetail.pos_profile).then((data) => {
      const modes = data?.payments ?? [];
      setPaymentModes(modes);
      setLoadingModes(false);

      const gatewayName = modes.find((row) => row.ep_payment_gateway)?.ep_payment_gateway;
      if (gatewayName) {
        fetchPaymentGatewayConfig(gatewayName).then((data) => setGatewayConfig(data));
      }
    });
  }, [openingDetail.pos_profile]);

  const customer = useCartStore((s) => s.customer);
  const items = useCartStore((s) => s.items);
  const freeItems = useCartStore((s) => s.freeItems);
  const payments = useCartStore((s) => s.payments);
  const salesInvoiceName = useCartStore((s) => s.salesInvoiceName);
  const setSalesInvoiceName = useCartStore((s) => s.setSalesInvoiceName);
  const discountOn = useCartStore((s) => s.discountOn);
  const discountPercentage = useCartStore((s) => s.discountPercentage);
  const couponCode = useCartStore((s) => s.couponCode);
  const updatePayment = useCartStore((s) => s.updatePayment);
  const resetCart = useCartStore((s) => s.resetCart);
  const loyaltyProgram = useCartStore((s) => s.loyaltyProgram);
  const loyaltyPointsBalance = useCartStore((s) => s.loyaltyPointsBalance);
  const loyaltyConversionFactor = useCartStore((s) => s.loyaltyConversionFactor);

  const [redeemLoyaltyPoints, setRedeemLoyaltyPoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState("");

  const paidAmount = roundCurrency(
    payments.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0),
    currencyPrecision,
  );

  // Redemption value can't exceed either the customer's balance or the
  // invoice total — mirrors erpnext's own validate_loyalty_points, which
  // frappe.throws if loyalty_amount ends up bigger than the total. Capping
  // client-side here just avoids a round trip to hit that error.
  const maxRedeemablePoints =
    loyaltyConversionFactor > 0
      ? Math.max(0, Math.min(loyaltyPointsBalance, Math.floor(grandTotal / loyaltyConversionFactor)))
      : 0;
  const loyaltyAmount =
    redeemLoyaltyPoints && loyaltyConversionFactor > 0
      ? roundCurrency((parseFloat(pointsToRedeem) || 0) * loyaltyConversionFactor, currencyPrecision)
      : 0;

  const balanceDue = roundCurrency(grandTotal - paidAmount - loyaltyAmount, currencyPrecision);

  const formatAmount = (value) =>
    `${currencySymbol}${(value ?? 0).toLocaleString("en-IN", {
      minimumFractionDigits: currencyPrecision,
      maximumFractionDigits: currencyPrecision,
    })}`;

  const getPaymentAmount = (mode_of_payment) =>
    payments.find((row) => row.mode_of_payment === mode_of_payment)?.amount ?? "";

  // At most one POS Payment Method row is flagged ep_payment_gateway per the
  // add_payment_gateway_fields patch — if the cashier has routed any amount to
  // it, checkout goes through that gateway (via PaymentGateways' registry)
  // instead of a direct submit. Swapping/adding gateways only touches that
  // registry + the backend's easy_pos.api.payment_gateways registry, never here.
  const gatewayRow = paymentModes.find((row) => row.ep_payment_gateway);
  const gatewayName = gatewayRow?.ep_payment_gateway;
  const gatewayAmount = gatewayRow ? parseFloat(getPaymentAmount(gatewayRow.mode_of_payment)) || 0 : 0;
  const payingViaGateway = !!(gatewayConfig?.enabled && gatewayAmount > 0);

  const buildCleanItems = () => [
    ...items.map(
      ({
        item_code, qty, rate, amount, serial_no, batch_no,
        discount_amount, discount_percentage, price_list_rate, pricing_rules, item_tax_template,
      }) => ({
        item_code, qty, rate, amount, serial_no, batch_no,
        discount_amount, discount_percentage, price_list_rate,
        pricing_rules: pricing_rules?.length ? pricing_rules.join(",") : undefined,
        item_tax_template,
      }),
    ),
    ...freeItems.map(({ item_code, qty, rate, uom, pricing_rules }) => ({
      item_code, qty, rate, amount: 0, is_free_item: 1, uom,
      pricing_rules: pricing_rules || undefined,
    })),
  ];

  const buildInvoicePayload = () => {
    const redeemedPoints = redeemLoyaltyPoints ? Math.floor(parseFloat(pointsToRedeem) || 0) : 0;
    return {
      customer,
      items: buildCleanItems(),
      payments,
      sales_invoice: salesInvoiceName,
      apply_discount_on: discountOn || undefined,
      additional_discount_percentage: roundCurrency(parseFloat(discountPercentage) || 0, floatPrecision),
      taxes,
      loyalty_program: loyaltyProgram || undefined,
      redeem_loyalty_points: redeemedPoints > 0 ? 1 : 0,
      loyalty_points: redeemedPoints,
    };
  };

  // Shared by both the manual and the gateway-confirmed completion paths —
  // prints the receipt (if enabled) and closes out the cart the same way
  // regardless of how the invoice got submitted.
  const finishCheckout = (invoiceName, receiptTab) => {
    if (invoiceName) {
      if (receiptTab) {
        const formatParam = printFormat ? `&format=${encodeURIComponent(printFormat)}` : "";
        // trigger_print=1 tells Frappe's own printview page to call window.print()
        // (and auto-close afterwards) as soon as it renders — no separate
        // window.print() call needed on our side, and it works even though
        // this tab is a different origin/page than the POS app itself.
        receiptTab.location.href = `/printview?doctype=Sales%20Invoice&name=${encodeURIComponent(invoiceName)}${formatParam}&trigger_print=1`;
      }
      resetCart();
      onClose();
    } else {
      receiptTab?.close();
      setError("Failed to complete payment");
    }
  };

  const validatePayment = () => {
    if (!customer) {
      setError("Please select a customer");
      return false;
    }
    if (items.length < 1) {
      setError("Please add one or more items to the cart");
      return false;
    }
    if (payments.length < 1 || paidAmount <= 0) {
      setError("Please enter an amount for at least one payment mode");
      return false;
    }
    return true;
  };

  const submitManualPayment = () => {
    setError("");
    setSubmitting(true);
    // Opened synchronously, in the same click, so browsers still attribute it
    // to a user gesture — a window.open() called later inside the postPaymentInvoice
    // .then() (after the network round-trip) loses that gesture and gets
    // silently popup-blocked instead of actually opening a tab.
    const receiptTab = printReceiptOnOrderComplete ? window.open("", "_blank") : null;
    postPaymentInvoice(buildInvoicePayload(), openingDetail, 1, couponCode || undefined).then((data) => {
      setSubmitting(false);
      finishCheckout(data?.name, receiptTab);
    });
  };

  const payWithGateway = () => {
    setError("");
    setSubmitting(true);

    // Unlike the manual flow, the receipt tab is NOT pre-opened here — the
    // Razorpay checkout modal opens in this same tab, so popping a tab the
    // instant "Pay with Razorpay" is clicked just yanks focus away from the
    // modal the cashier still needs to interact with. It's opened instead from
    // onPaymentConfirmed below, which fires inside Razorpay's own success
    // callback — still close enough to the payment gesture to dodge popup
    // blockers, but only once there's actually a receipt to show.
    let receiptTab = null;
    const onPaymentConfirmed = () => {
      if (!printReceiptOnOrderComplete) return;
      receiptTab = window.open("", "_blank");
      receiptTab?.document.write(
        "<title>Receipt</title><body style=\"font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#666;text-align:center;padding:0 24px\">Finishing up — your receipt will print here once it's confirmed.</body>",
      );
    };

    getPaymentGateway(gatewayName)
      .pay({
        invoicePayload: buildInvoicePayload(),
        openingDetail,
        amount: gatewayAmount,
        couponCode: couponCode || undefined,
        // Lets a retry (after a dismissed/failed payment) update the same Draft
        // invoice instead of create_payment_gateway_order minting a new one —
        // see buildInvoicePayload's sales_invoice field.
        onOrderCreated: setSalesInvoiceName,
        onPaymentConfirmed,
        // A failed attempt doesn't end the checkout — Razorpay's modal lets the
        // cashier/customer immediately retry with another method — so just
        // surface a non-blocking notice rather than tearing down the flow.
        onAttemptFailed: () => setError("That attempt failed — you can try another payment method in the Razorpay window."),
      })
      .then((data) => {
        setSubmitting(false);
        setError("");
        finishCheckout(data?.name, receiptTab);
      })
      .catch((err) => {
        setSubmitting(false);
        receiptTab?.close();
        // A dismissed checkout modal isn't an error — the invoice is left as a
        // Draft, retrievable the same way any other held sale is.
        if (!err?.cancelled) {
          setError(err?.message || "Failed to complete payment");
        }
      });
  };

  const createPaymentInvoice = () => {
    if (!validatePayment()) return;
    if (payingViaGateway) {
      payWithGateway();
    } else {
      submitManualPayment();
    }
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
                {payingViaGateway ? `Waiting for ${gatewayName}…` : "Submitting…"}
              </>
            ) : payingViaGateway ? (
              `Pay with ${gatewayName}`
            ) : (
              "Complete Payment"
            )}
          </button>
        </>
      }
    >
      <ErrorAlert message={error} />

      <div className="invoice-pay-pill mb-3">
        <span className="invoice-pay-pill-label">Grand Total</span>
        <span className="invoice-pay-pill-value">{formatAmount(grandTotal)}</span>
      </div>

      {loyaltyProgram && loyaltyPointsBalance > 0 && (
        <div className="mb-3">
          <CheckboxField
            label={`Redeem Loyalty Points (${loyaltyPointsBalance} available)`}
            checked={redeemLoyaltyPoints}
            onChange={(checked) => {
              setRedeemLoyaltyPoints(checked);
              if (!checked) setPointsToRedeem("");
            }}
          />
          {redeemLoyaltyPoints && (
            <div className="d-flex align-items-center gap-2">
              <div style={{ flex: 1 }}>
                <NumberField
                  placeholder="0"
                  min={0}
                  max={maxRedeemablePoints}
                  value={pointsToRedeem}
                  onChange={(value) =>
                    setPointsToRedeem(value === "" ? "" : Math.min(value, maxRedeemablePoints))
                  }
                />
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", whiteSpace: "nowrap", marginBottom: 14 }}>
                = {formatAmount(loyaltyAmount)}
              </div>
            </div>
          )}
        </div>
      )}

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
              <div className="invoice-pay-row-label">
                {row.mode_of_payment}
                {row.ep_payment_gateway && (
                  <span
                    className="badge bg-primary-subtle text-primary ms-2"
                    style={{ fontSize: 10, fontWeight: 500 }}
                    title={
                      gatewayConfig?.enabled
                        ? `Cashier enters the amount to charge; a ${row.ep_payment_gateway} checkout opens on Complete Payment.`
                        : `${row.ep_payment_gateway} is not configured yet.`
                    }
                  >
                    {row.ep_payment_gateway}
                  </span>
                )}
              </div>
              <div className="invoice-pay-row-field">
                <CurrencyField
                  className="mb-0"
                  placeholder="0"
                  min={0}
                  disabled={row.ep_payment_gateway && !gatewayConfig?.enabled}
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
        {loyaltyAmount > 0 && (
          <div>
            <div className="invoice-pay-figure-label">Loyalty Redeemed</div>
            <div className="invoice-pay-figure-value" style={{ color: "var(--color-success-text)" }}>
              {formatAmount(loyaltyAmount)}
            </div>
          </div>
        )}
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
