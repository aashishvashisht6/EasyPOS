import { useEffect, useRef, useState } from "react";
import usePOSSessionStore from "../store/posSessionStore";
import {
  getCustomerDisplayChannel,
  sendCustomerDisplayMessage,
  subscribeCustomerDisplayChannel,
} from "../utils/customerDisplayChannel";
import { IdleScreen, CartView, PaymentView, ThankYouScreen } from "../components/CustomerDisplay";
import "../components/CustomerDisplay/style.css";

const THANK_YOU_TIMEOUT_MS = 8000;

// Full-bleed kiosk view opened in a second window (see Cart's "Open Customer
// Display" button + hooks/useCustomerDisplayBroadcaster.js) — purely
// presentational, renders whatever the Terminal window broadcasts.
const CustomerDisplayPage = () => {
  const posProfile = usePOSSessionStore((s) => s.posProfile);
  const [view, setViewState] = useState("idle");
  const [cartSnapshot, setCartSnapshot] = useState(null);
  const [payment, setPayment] = useState(null);
  const [complete, setComplete] = useState(null);
  const thankYouTimer = useRef(null);
  const viewRef = useRef("idle");
  const setView = (next) => {
    viewRef.current = next;
    setViewState(next);
  };

  useEffect(() => {
    if (!posProfile) return undefined;
    const channel = getCustomerDisplayChannel(posProfile);

    const unsubscribe = subscribeCustomerDisplayChannel(channel, (message) => {
      if (!message) return;
      // A completed checkout's resetCart() fires a CART_UPDATE/CART_IDLE right
      // behind INVOICE_COMPLETE (cart goes empty) — ignore it so the thank-you
      // screen isn't instantly stomped; the timer below controls that instead.
      if (viewRef.current === "complete" && (message.type === "CART_UPDATE" || message.type === "CART_IDLE")) {
        return;
      }
      if (thankYouTimer.current) {
        clearTimeout(thankYouTimer.current);
        thankYouTimer.current = null;
      }
      switch (message.type) {
        case "CART_UPDATE":
          setCartSnapshot(message.payload);
          setView("cart");
          break;
        case "CART_IDLE":
          setCartSnapshot(null);
          setView("idle");
          break;
        case "PAYMENT_STATUS":
          setPayment(message.payload);
          setView("payment");
          break;
        case "INVOICE_COMPLETE":
          setComplete(message.payload);
          setView("complete");
          thankYouTimer.current = setTimeout(() => {
            setView("idle");
            setCartSnapshot(null);
          }, THANK_YOU_TIMEOUT_MS);
          break;
        default:
          break;
      }
    });

    sendCustomerDisplayMessage(channel, "HELLO");

    return () => {
      unsubscribe();
      channel.close();
      if (thankYouTimer.current) clearTimeout(thankYouTimer.current);
    };
  }, [posProfile]);

  let content;
  if (view === "cart" && cartSnapshot) {
    content = <CartView snapshot={cartSnapshot} />;
  } else if (view === "payment" && payment) {
    content = (
      <PaymentView
        grandTotal={payment.grandTotal}
        currencySymbol={cartSnapshot?.currencySymbol}
        precision={cartSnapshot?.precision}
      />
    );
  } else if (view === "complete" && complete) {
    content = (
      <ThankYouScreen
        complete={complete}
        currencySymbol={cartSnapshot?.currencySymbol}
        precision={cartSnapshot?.precision}
      />
    );
  } else {
    content = <IdleScreen />;
  }

  return <div className="customer-display-page">{content}</div>;
};

export default CustomerDisplayPage;
