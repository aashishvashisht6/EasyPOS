import { createPaymentGatewayOrder, verifyPaymentGatewayOrder } from "../../api/Payment";

let scriptPromise = null;

// Razorpay's Checkout.js is always loaded from their own CDN — there is no
// npm bundle Razorpay ships as the source of truth, and vendoring/mirroring
// it would silently drift from their fraud/3DS updates. Cached so repeated
// gateway checkouts in the same session don't re-fetch/re-inject the script.
const loadScript = () => {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Razorpay checkout"));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
};

// Common gateway interface (see index.js): pay() resolves with the finalized
// Sales Invoice dict on success, or rejects with either { cancelled: true }
// (customer closed the modal — not an error) or an Error with a user-facing message.
const pay = ({ invoicePayload, openingDetail, amount, couponCode }) =>
  Promise.all([
    createPaymentGatewayOrder("Razorpay", invoicePayload, openingDetail, amount),
    loadScript(),
  ]).then(([order]) => {
    if (!order?.order_id) throw new Error("Failed to start Razorpay payment");

    return new Promise((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "POS Payment",
        description: `Invoice ${order.sales_invoice}`,
        handler: (response) => {
          verifyPaymentGatewayOrder(
            "Razorpay",
            order.sales_invoice,
            {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            },
            couponCode,
          ).then(resolve, reject);
        },
        modal: {
          ondismiss: () => reject({ cancelled: true }),
        },
      });
      rzp.on("payment.failed", () => reject(new Error("Razorpay payment failed. The invoice is saved as a draft — retry from Held Sales.")));
      rzp.open();
    });
  });

export default { name: "Razorpay", pay };
