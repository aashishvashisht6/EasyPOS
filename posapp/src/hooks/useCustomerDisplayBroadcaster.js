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
			currencySymbol,
			precision: currencyPrecision,
		};
	};

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
				sendCustomerDisplayMessage(
					channel,
					cartItems.length ? "CART_UPDATE" : "CART_IDLE",
					cartItems.length ? buildCartSnapshot() : undefined
				);
			}
		});

		return () => {
			unsubscribe();
			channel.close();
			channelRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
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

	return { sendPaymentStatus, sendInvoiceComplete, customerDisplayEnabled };
};

export default useCustomerDisplayBroadcaster;
