import { useEffect, useRef } from "react";
import usePOSSessionStore from "../store/posSessionStore";
import useCartStore from "../store/cartStore";
import { computeCartTotals } from "../utils/tax";
import {
	getCustomerDisplayChannel,
	sendCustomerDisplayMessage,
	subscribeCustomerDisplayChannel,
} from "../utils/customerDisplayChannel";

// Mounted once from Cart — mirrors the cart/totals it already computes for
// itself onto the customer-facing second-screen window (see
// utils/customerDisplayChannel.js). Returns senders for the checkout-lifecycle
// events (payment/complete) Cart triggers explicitly, since those aren't
// derivable from store state alone.
const useCustomerDisplayBroadcaster = () => {
	const posProfile = usePOSSessionStore((s) => s.posProfile);
	const customerDisplayEnabled = usePOSSessionStore((s) => s.customerDisplayEnabled);
	const currencySymbol = usePOSSessionStore((s) => s.currencySymbol);
	const numberFormat = usePOSSessionStore((s) => s.numberFormat);
	const symbolOnRight = usePOSSessionStore((s) => s.symbolOnRight);
	const currencyPrecision = usePOSSessionStore((s) => s.currencyPrecision);
	const taxTemplateRows = usePOSSessionStore((s) => s.taxTemplateRows);

	const customerName = useCartStore((s) => s.customerName);
	const cartItems = useCartStore((s) => s.items);
	const discountOn = useCartStore((s) => s.discountOn);
	const discountPercentage = useCartStore((s) => s.discountPercentage);

	const channelRef = useRef(null);

	const buildCartSnapshot = () => {
		const netTotal = cartItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
		const { taxRows, totalTax, discountAmount, grandTotal } = computeCartTotals({
			items: cartItems,
			taxTemplateRows,
			netTotal,
			discountOn,
			discountPercentage,
			precision: currencyPrecision,
		});
		return {
			customerName,
			items: cartItems.map(({ item_code, qty, rate, amount }) => ({
				item_code,
				qty,
				rate,
				amount,
			})),
			netTotal,
			taxRows,
			totalTax,
			discountAmount,
			grandTotal,
			currencyFormat: {
				symbol: currencySymbol,
				number_format: numberFormat,
				symbol_on_right: symbolOnRight,
			},
			precision: currencyPrecision,
		};
	};

	// The HELLO handler below is subscribed once per channel, so it reads the
	// current cart through this ref instead of the cart it closed over (which
	// was usually empty, leaving a display opened mid-sale stuck on idle).
	const currentMessageRef = useRef(() => ["CART_IDLE"]);
	useEffect(() => {
		currentMessageRef.current = () =>
			cartItems.length ? ["CART_UPDATE", buildCartSnapshot()] : ["CART_IDLE"];
	});

	useEffect(() => {
		if (!customerDisplayEnabled || !posProfile) {
			channelRef.current?.close();
			channelRef.current = null;
			return undefined;
		}

		const channel = getCustomerDisplayChannel(posProfile);
		channelRef.current = channel;

		const unsubscribe = subscribeCustomerDisplayChannel(channel, (message) => {
			if (message?.type === "HELLO") {
				const [type, payload] = currentMessageRef.current();
				sendCustomerDisplayMessage(channel, type, payload);
			}
		});

		return () => {
			unsubscribe();
			channel.close();
			channelRef.current = null;
		};
	}, [customerDisplayEnabled, posProfile]);

	useEffect(() => {
		const channel = channelRef.current;
		if (!channel) return;
		if (cartItems.length === 0) {
			sendCustomerDisplayMessage(channel, "CART_IDLE");
			return;
		}
		sendCustomerDisplayMessage(channel, "CART_UPDATE", buildCartSnapshot());
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		cartItems,
		customerName,
		discountOn,
		discountPercentage,
		taxTemplateRows,
		currencySymbol,
		numberFormat,
		symbolOnRight,
		currencyPrecision,
	]);

	const sendPaymentStatus = (payload) => {
		if (channelRef.current)
			sendCustomerDisplayMessage(channelRef.current, "PAYMENT_STATUS", payload);
	};

	const sendInvoiceComplete = (payload) => {
		if (channelRef.current)
			sendCustomerDisplayMessage(channelRef.current, "INVOICE_COMPLETE", payload);
	};

	// One bill (by-item split) or one payer's share (even/custom split) is
	// paid but the sale isn't finished — deliberately not INVOICE_COMPLETE,
	// whose thank-you screen times out to idle while the cart is still open.
	const sendSplitPartComplete = (payload) => {
		if (channelRef.current)
			sendCustomerDisplayMessage(channelRef.current, "SPLIT_PART_COMPLETE", payload);
	};

	return { sendPaymentStatus, sendInvoiceComplete, sendSplitPartComplete, customerDisplayEnabled };
};

export default useCustomerDisplayBroadcaster;
