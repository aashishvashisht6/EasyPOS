import { useEffect, useState } from "react";
import "./style.css";
import { postPaymentInvoice } from "../../api/Invoice";
import { updateQueuedInvoice } from "../../engine/outbox";
import { fetchProfile } from "../../api/POSProfile";
import { fetchPaymentGatewayConfig } from "../../api/Payment";
import { getPaymentGateway } from "../PaymentGateways";
import usePOSSessionStore from "../../store/posSessionStore";
import useCartStore from "../../store/cartStore";
import useConnectivityStore from "../../engine/connectivity";
import { Modal, CurrencyField, NumberField, CheckboxField, ErrorAlert } from "../common";
import { roundCurrency } from "../../utils/number";
import { mergePayments, netTurnPayments } from "../../utils/splitBill";

// `bill` (optional) pays one part of a Split Bill (components/Cart/SplitBillModal.jsx)
// instead of the whole cart: { label, customer, customerName, items, freeItems,
// discountOn, discountPercentage, couponCode, salesInvoiceName, pendingOfflineId,
// splitGroup, splitIndex, allowLoyalty, keepLoyaltyProgram } — and, for one
// payer's turn of an even/custom split, also { turn: true, amountDue,
// priorPayments, finalTurn, buildRemarks(turnPayments) }. Without it, this pays
// the cart exactly as it always has. With it, the cart is never reset here —
// the split decides when the whole sale is done.
const InvoicePay = ({ onClose, grandTotal, taxes, onComplete, bill }) => {
import { getServerMessage } from "../../utils/serverError";
import useCurrencyFormatter from "../../hooks/useCurrencyFormatter";
import { getLanguage, tData, useTranslation } from "../../translation";

const InvoicePay = ({ onClose, grandTotal, taxes, onComplete }) => {
  const { __ } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [paymentModes, setPaymentModes] = useState([]);
  const [loadingModes, setLoadingModes] = useState(true);
  const [gatewayConfig, setGatewayConfig] = useState(null);
  const openingDetail = usePOSSessionStore((s) => s.openingDetail);
  const money = useCurrencyFormatter();
  const currencyPrecision = usePOSSessionStore((s) => s.currencyPrecision);
  const currencyCode = usePOSSessionStore((s) => s.currencyCode);
  const companyCurrency = usePOSSessionStore((s) => s.companyCurrency);
  // ERPNext only redeems loyalty points in the company's currency (see
  // easy_pos.api.pos._save_sales_invoice), so hide redemption on a profile
  // that sells in another currency.
  const loyaltyRedemptionBlocked = currencyCode !== companyCurrency;
  const floatPrecision = usePOSSessionStore((s) => s.floatPrecision);
  const printReceiptOnOrderComplete = usePOSSessionStore((s) => s.printReceiptOnOrderComplete);
  const printFormat = usePOSSessionStore((s) => s.printFormat);
  const isOnline = useConnectivityStore((s) => s.isOnline);

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

  const cartCustomer = useCartStore((s) => s.customer);
  const cartCustomerName = useCartStore((s) => s.customerName);
  const cartItems = useCartStore((s) => s.items);
  const cartFreeItems = useCartStore((s) => s.freeItems);
  const cartPayments = useCartStore((s) => s.payments);
  const cartSalesInvoiceName = useCartStore((s) => s.salesInvoiceName);
  const setCartSalesInvoiceName = useCartStore((s) => s.setSalesInvoiceName);
  const cartPendingOfflineId = useCartStore((s) => s.pendingOfflineId);
  const setCartPendingOfflineId = useCartStore((s) => s.setPendingOfflineId);
  const cartDiscountOn = useCartStore((s) => s.discountOn);
  const cartDiscountPercentage = useCartStore((s) => s.discountPercentage);
  const cartCouponCode = useCartStore((s) => s.couponCode);
  const updateCartPayment = useCartStore((s) => s.updatePayment);
  const resetCart = useCartStore((s) => s.resetCart);

  // A split bill carries its own lines/customer/draft link and keeps its
  // payments local, so paying one bill never touches the frozen cart.
  const [billPayments, setBillPayments] = useState([]);
  const [billInvoiceName, setBillInvoiceName] = useState(bill?.salesInvoiceName ?? "");
  const [billPendingOfflineId, setBillPendingOfflineId] = useState(bill?.pendingOfflineId ?? "");
  const [printSlip, setPrintSlip] = useState(false);
  const customer = bill ? bill.customer : cartCustomer;
  const customerName = bill ? bill.customerName : cartCustomerName;
  const items = bill ? bill.items : cartItems;
  const freeItems = bill ? bill.freeItems : cartFreeItems;
  const payments = bill ? billPayments : cartPayments;
  const salesInvoiceName = bill ? billInvoiceName : cartSalesInvoiceName;
  const setSalesInvoiceName = bill ? setBillInvoiceName : setCartSalesInvoiceName;
  const pendingOfflineId = bill ? billPendingOfflineId : cartPendingOfflineId;
  const setPendingOfflineId = bill ? setBillPendingOfflineId : setCartPendingOfflineId;
  const discountOn = bill ? bill.discountOn : cartDiscountOn;
  const discountPercentage = bill ? bill.discountPercentage : cartDiscountPercentage;
  const couponCode = bill ? bill.couponCode : cartCouponCode;
  const updatePayment = bill
    ? (mode_of_payment, amount) =>
        setBillPayments((rows) =>
          rows.some((row) => row.mode_of_payment === mode_of_payment)
            ? rows.map((row) => (row.mode_of_payment === mode_of_payment ? { ...row, amount } : row))
            : [...rows, { mode_of_payment, amount }],
        )
    : updateCartPayment;

  // One payer's turn of an even/custom split: they owe their share, not the
  // invoice total, and only the last turn submits the invoice — earlier turns
  // save it as a Draft with the payments collected so far.
  const isTurn = !!bill?.turn;
  const isInterimTurn = isTurn && !bill.finalTurn;
  const amountDue = isTurn ? bill.amountDue : grandTotal;
  const loyaltyAllowed = !bill || (bill.allowLoyalty && !isInterimTurn);
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
      ? Math.max(0, Math.min(loyaltyPointsBalance, Math.floor(amountDue / loyaltyConversionFactor)))
      : 0;
  const loyaltyAmount =
    redeemLoyaltyPoints && loyaltyConversionFactor > 0
      ? roundCurrency((parseFloat(pointsToRedeem) || 0) * loyaltyConversionFactor, currencyPrecision)
      : 0;

  const balanceDue = roundCurrency(amountDue - paidAmount - loyaltyAmount, currencyPrecision);

  const formatAmount = (value) => money(value);

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
  // A gateway checkout needs a live round trip to the payment provider — with
  // no connection, the row stays visible (so a cashier can see why) but is
  // disabled and never selectable, so createPaymentInvoice always falls
  // through to the manual/offline-queue path instead. Also excluded while
  // resuming a still-queued offline draft (pendingOfflineId) — that sale was
  // rung up offline in the first place, so it stays on the manual/local-queue
  // path even if connectivity happens to be back by the time it's finished.
  // Also excluded on an interim split turn: verify_payment_gateway_order
  // submits the invoice as soon as the charge verifies, which would finalize it
  // while later payers still owe their share — a gateway can only take the last turn.
  const gatewayBlockedForTurn = isInterimTurn;
  const payingViaGateway = !!(
    gatewayConfig?.enabled && isOnline && !pendingOfflineId && !gatewayBlockedForTurn && gatewayAmount > 0
  );

  // What this payer actually owes, by mode — change handed back comes off
  // their cash row so the invoice's payments add up to its total.
  const turnPayments = isTurn
    ? netTurnPayments(
        payments,
        roundCurrency(amountDue - loyaltyAmount, currencyPrecision),
        paymentModes.filter((row) => row.ep_payment_gateway).map((row) => row.mode_of_payment),
        currencyPrecision,
      )
    : null;
  const submitFlag = isInterimTurn ? 0 : 1;

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
      payments: isTurn ? mergePayments([bill.priorPayments ?? [], turnPayments]) : payments,
      sales_invoice: salesInvoiceName,
      ep_split_group: bill?.splitGroup || undefined,
      ep_split_index: bill?.splitIndex || undefined,
      remarks: isTurn ? bill.buildRemarks?.(turnPayments) : undefined,
      apply_discount_on: discountOn || undefined,
      additional_discount_percentage: roundCurrency(parseFloat(discountPercentage) || 0, floatPrecision),
      taxes,
      // A split bill for a different customer than the cart's isn't enrolled
      // in the cart customer's program — ERPNext resolves that customer's own.
      loyalty_program: (!bill || bill.keepLoyaltyProgram ? loyaltyProgram : "") || undefined,
      redeem_loyalty_points: redeemedPoints > 0 ? 1 : 0,
      loyalty_points: redeemedPoints,
    };
  };

  // Bare-bones client-rendered receipt for an invoice that only exists in the
  // local offline queue (engine/outbox.js) — there's no real Sales Invoice on
  // the server yet, so /printview (which needs one) isn't reachable. Reprints
  // with the real print format automatically once the queue entry syncs and
  // the cashier reopens it from Invoices/Sync.
  const buildOfflineReceiptHtml = (displayId) => {
    const rows = [
      ...items.map((row) => ({ label: row.item_code, qty: row.qty, amount: row.amount })),
      ...freeItems.map((row) => ({ label: __("{item} (Free)", { item: row.item_code }), qty: row.qty, amount: 0 })),
    ];
    const itemRows = rows
      .map(
        (row) =>
          `<tr><td>${row.label}</td><td style="text-align:center">${row.qty}</td><td style="text-align:end">${formatAmount(row.amount)}</td></tr>`,
      )
      .join("");
    const paymentRows = payments
      .filter((row) => parseFloat(row.amount) > 0)
      .map((row) => `<tr><td colspan="2">${tData(row.mode_of_payment)}</td><td style="text-align:end">${formatAmount(row.amount)}</td></tr>`)
      .join("");
    return `<!doctype html><html lang="${getLanguage()}" dir="${document.documentElement.dir || "ltr"}"><head><title>${__("Receipt")} — ${displayId}</title><style>
      body{font-family:monospace;max-width:360px;margin:24px auto;color:#222}
      h3{margin:0 0 2px}
      .muted{color:#777;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
      td{padding:3px 0}
      .banner{background:#fff3cd;color:#7a5b00;padding:6px 10px;font-size:12px;border-radius:4px;margin:10px 0}
      .total{border-top:1px solid #333;margin-top:8px;padding-top:6px;font-weight:bold;display:flex;justify-content:space-between}
    </style></head><body>
      <h3>${__("Receipt")}</h3>
      <div class="muted">${displayId}</div>
      <div class="banner">${__("Offline — pending sync. Reprint from Invoices once synced.")}</div>
      <div class="muted">${__("Customer")}: ${customerName || customer || __("Walk-in")}</div>
      <table>${itemRows}</table>
      <table>${paymentRows}</table>
      <div class="total"><span>${__("Grand Total")}</span><span>${formatAmount(grandTotal)}</span></div>
      <script>window.print();</script>
    </body></html>`;
  };

  // A paid-so-far slip for an interim payer of an even/custom split — the real
  // receipt only prints once the last payer completes the invoice.
  const buildPaymentSlipHtml = (invoiceName) => {
    const rows = (turnPayments ?? [])
      .map((row) => `<tr><td>${row.mode_of_payment}</td><td style="text-align:right">${formatAmount(row.amount)}</td></tr>`)
      .join("");
    return `<!doctype html><html><head><title>Payment slip — ${invoiceName}</title><style>
      body{font-family:monospace;max-width:360px;margin:24px auto;color:#222}
      h3{margin:0 0 2px}
      .muted{color:#777;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
      td{padding:3px 0}
      .total{border-top:1px solid #333;margin-top:8px;padding-top:6px;font-weight:bold;display:flex;justify-content:space-between}
    </style></head><body>
      <h3>Payment slip</h3>
      <div class="muted">${invoiceName} · ${bill?.label ?? ""}</div>
      <div class="muted">Customer: ${customerName || customer || "Walk-in"}</div>
      <table>${rows}</table>
      <div class="total"><span>Paid</span><span>${formatAmount(amountDue)}</span></div>
      <div class="muted" style="margin-top:8px">Invoice total ${formatAmount(grandTotal)} — receipt issued once fully paid.</div>
      <script>window.print();</script>
    </body></html>`;
  };

  // Shared by both the manual and the gateway-confirmed completion paths —
  // prints the receipt (if enabled) and closes out the cart the same way
  // regardless of how the invoice got submitted.
  const finishCheckout = (data, receiptTab) => {
    const invoiceName = data?.name;
    if (invoiceName) {
      if (receiptTab && isInterimTurn) {
        receiptTab.document.open();
        receiptTab.document.write(buildPaymentSlipHtml(invoiceName));
        receiptTab.document.close();
      } else if (receiptTab) {
        if (data?.__offline) {
          receiptTab.document.open();
          receiptTab.document.write(buildOfflineReceiptHtml(invoiceName));
          receiptTab.document.close();
        } else {
          const formatParam = printFormat ? `&format=${encodeURIComponent(printFormat)}` : "";
          // trigger_print=1 tells Frappe's own printview page to call window.print()
          // (and auto-close afterwards) as soon as it renders — no separate
          // window.print() call needed on our side, and it works even though
          // this tab is a different origin/page than the POS app itself.
          receiptTab.location.href = `/printview?doctype=Sales%20Invoice&name=${encodeURIComponent(invoiceName)}${formatParam}&trigger_print=1`;
        }
      }
      onComplete?.({
        invoiceName,
        offlineId: data?.__offline ? data.offline_id : "",
        grandTotal,
        amountPaid: paidAmount,
        changeDue: balanceDue < 0 ? roundCurrency(-balanceDue, currencyPrecision) : 0,
        turnPayments,
      });
      if (!bill) resetCart();
      onClose();
    } else {
      receiptTab?.close();
      setError(__("Failed to complete payment"));
    }
  };

  const validatePayment = () => {
    if (!customer) {
      setError(__("Please select a customer"));
      return false;
    }
    if (items.length < 1) {
      setError(__("Please add one or more items to the cart"));
      return false;
    }
    if (payments.length < 1 || paidAmount <= 0) {
      setError(__("Please enter an amount for at least one payment mode"));
      return false;
    }
    // A split payer must cover their whole share — anything short would be
    // silently left unpaid once the next payer's turn starts.
    if (isTurn && balanceDue > 0) {
      setError(`This payer still owes ${formatAmount(balanceDue)}`);
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
    const wantsPrint = isInterimTurn ? printSlip : printReceiptOnOrderComplete;
    const receiptTab = wantsPrint ? window.open("", "_blank") : null;
    const invoicePayload = buildInvoicePayload();
    // Resuming a still-queued offline draft (see Cart/index.jsx's selectDraft)
    // updates that same queue row instead of going through create_invoice
    // again, so completing it never queues a second, duplicate offline invoice.
    const paymentPromise = pendingOfflineId
      ? updateQueuedInvoice(pendingOfflineId, {
          invoice: invoicePayload,
          opening_details: openingDetail,
          submit: submitFlag,
          coupon_code: couponCode || undefined,
        }).then((result) => {
          if (result?.synced) {
            setPendingOfflineId("");
            return postPaymentInvoice(
              { ...invoicePayload, sales_invoice: result.name },
              openingDetail,
              submitFlag,
              couponCode || undefined,
            );
          }
          return result?.data?.message;
        })
      : postPaymentInvoice(invoicePayload, openingDetail, submitFlag, couponCode || undefined);

    paymentPromise
      .then((data) => {
        setSubmitting(false);
        finishCheckout(data, receiptTab);
      })
      .catch((err) => {
        setSubmitting(false);
        receiptTab?.close();
        setError(getServerMessage(err) || __("Failed to complete payment"));
      });
  };

  const payWithGateway = () => {
    setError("");
    setSubmitting(true);

    // Opened synchronously, inside the actual "Pay with Razorpay" click, same
    // as submitManualPayment's receiptTab — a window.open() called later from
    // inside Razorpay's own `handler` callback (fired via postMessage from its
    // checkout iframe, not a direct continuation of the click) isn't treated
    // as user-gesture-initiated by the browser and gets silently popup-blocked.
    // That's why this used to only work for the manual/cash flow. Refocusing
    // immediately after keeps the Razorpay modal in front instead of the
    // cashier getting yanked to the new (mostly blank, "finishing up") tab.
    const receiptTab = printReceiptOnOrderComplete ? window.open("", "_blank") : null;
    if (receiptTab) {
      receiptTab.document.write(
        `<title>${__("Receipt")}</title><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#666;text-align:center;padding:0 24px">${__(
          "Finishing up — your receipt will print here once it's confirmed.",
        )}</body>`,
      );
      window.focus();
    }

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
        // A failed attempt doesn't end the checkout — Razorpay's modal lets the
        // cashier/customer immediately retry with another method — so just
        // surface a non-blocking notice rather than tearing down the flow.
        onAttemptFailed: () =>
          setError(__("That attempt failed — you can try another payment method in the {gateway} window.", { gateway: gatewayName })),
      })
      .then((data) => {
        setSubmitting(false);
        setError("");
        finishCheckout(data, receiptTab);
      })
      .catch((err) => {
        setSubmitting(false);
        receiptTab?.close();
        // A dismissed checkout modal isn't an error — the invoice is left as a
        // Draft, retrievable the same way any other held sale is.
        if (!err?.cancelled) {
          setError(err?.message || __("Failed to complete payment"));
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
      title={bill ? `Take Payment — ${bill.label}` : "Take Payment"}
      subtitle={
        isTurn
          ? "Enter what this payer is handing over; change is worked out against their share."
          : "Enter the amount received for each payment mode."
      }
      title={__("Take Payment")}
      subtitle={__("Enter the amount received for each payment mode.")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="pos-btn pos-btn-secondary" onClick={onClose}>
            {__("Cancel")}
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
                {payingViaGateway ? __("Waiting for {gateway}…", { gateway: gatewayName }) : __("Submitting…")}
              </>
            ) : payingViaGateway ? (
              __("Pay with {gateway}", { gateway: gatewayName })
            ) : (
              isInterimTurn ? "Record Payment" : "Complete Payment"
              __("Complete Payment")
            )}
          </button>
        </>
      }
    >
      <ErrorAlert message={error} />

      <div className="invoice-pay-pill mb-3">
        <span className="invoice-pay-pill-label">{isTurn ? "Amount Due" : "Grand Total"}</span>
        <span className="invoice-pay-pill-value">{formatAmount(amountDue)}</span>
        <span className="invoice-pay-pill-label">{__("Grand Total")}</span>
        <span className="invoice-pay-pill-value">{formatAmount(grandTotal)}</span>
      </div>
      {isTurn && (
        <div className="mb-3" style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: -8 }}>
          Invoice total {formatAmount(grandTotal)}
          {bill.priorPayments?.length > 0 &&
            ` · ${formatAmount(bill.priorPayments.reduce((sum, row) => sum + (row.amount || 0), 0))} already paid`}
        </div>
      )}

      {loyaltyAllowed && loyaltyProgram && loyaltyPointsBalance > 0 && (
      {loyaltyProgram && loyaltyPointsBalance > 0 && loyaltyRedemptionBlocked && (
        <div className="mb-3" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          {__("Loyalty points can't be redeemed in {currency}. ERPNext only redeems them in the company's currency ({company_currency}).", {
            currency: currencyCode,
            company_currency: companyCurrency,
          })}
        </div>
      )}

      {loyaltyProgram && loyaltyPointsBalance > 0 && !loyaltyRedemptionBlocked && (
        <div className="mb-3">
          <CheckboxField
            label={__("Redeem Loyalty Points ({n} available)", { n: loyaltyPointsBalance })}
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

      <label className="pos-field-label">{__("Payment Summary")}</label>

      {loadingModes ? (
        <div className="text-center py-3">
          <span className="spinner-border spinner-border-sm" role="status" />
        </div>
      ) : paymentModes.length === 0 ? (
        <div className="text-muted text-center py-3" style={{ fontSize: 13 }}>
          {__("No payment modes configured for this POS Profile.")}
        </div>
      ) : (
        <div className="invoice-pay-rows mb-3">
          {paymentModes.map((row) => (
            <div className="invoice-pay-row" key={row.mode_of_payment}>
              <div className="invoice-pay-row-label">
                {tData(row.mode_of_payment)}
                {row.ep_payment_gateway && (
                  <span
                    className={`badge ms-2 ${!isOnline ? "bg-secondary-subtle text-secondary" : "bg-primary-subtle text-primary"}`}
                    style={{ fontSize: 10, fontWeight: 500 }}
                    title={
                      !isOnline
                        ? `${row.ep_payment_gateway} needs a connection — unavailable while offline.`
                        : gatewayBlockedForTurn
                        ? `${row.ep_payment_gateway} can only take the last payer's turn of a split bill.`
                        ? __("{gateway} needs a connection — unavailable while offline.", { gateway: row.ep_payment_gateway })
                        : gatewayConfig?.enabled
                        ? __("Cashier enters the amount to charge; a {gateway} checkout opens on Complete Payment.", {
                            gateway: row.ep_payment_gateway,
                          })
                        : __("{gateway} is not configured yet.", { gateway: row.ep_payment_gateway })
                    }
                  >
                    {!isOnline ? __("{gateway} — offline", { gateway: row.ep_payment_gateway }) : row.ep_payment_gateway}
                  </span>
                )}
              </div>
              <div className="invoice-pay-row-field">
                <CurrencyField
                  className="mb-0"
                  placeholder="0"
                  min={0}
                  disabled={
                    row.ep_payment_gateway && (!gatewayConfig?.enabled || !isOnline || gatewayBlockedForTurn)
                  }
                  value={getPaymentAmount(row.mode_of_payment)}
                  onChange={(value) => updatePayment(row.mode_of_payment, value === "" ? 0 : value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {isInterimTurn && (
        <CheckboxField label="Print a payment slip for this payer" checked={printSlip} onChange={setPrintSlip} />
      )}

      <div className="invoice-pay-summary">
        <div>
          <div className="invoice-pay-figure-label">{__("Paid Amount")}</div>
          <div className="invoice-pay-figure-value">{formatAmount(paidAmount)}</div>
        </div>
        {loyaltyAmount > 0 && (
          <div>
            <div className="invoice-pay-figure-label">{__("Loyalty Redeemed")}</div>
            <div className="invoice-pay-figure-value" style={{ color: "var(--color-success-text)" }}>
              {formatAmount(loyaltyAmount)}
            </div>
          </div>
        )}
        <div>
          <div className="invoice-pay-figure-label">{balanceDue > 0 ? __("Balance Due") : __("Change to Return")}</div>
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
