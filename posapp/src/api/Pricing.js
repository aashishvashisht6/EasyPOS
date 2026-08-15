import { engineGet, enginePost } from "../engine";

// Resolves discount/rate for the current cart lines through ERPNext's own
// Pricing Rule engine (easy_pos.api.pricing.get_cart_pricing) — matching,
// priority/stacking, coupon codes, and Product Discount free items are all
// evaluated server-side there, this just wraps the call. Errors (eg. an
// invalid/expired coupon code, which the backend rejects via frappe.throw)
// are deliberately left to propagate rather than swallowed, so the cashier
// sees why a coupon didn't apply instead of the discount just silently
// not showing up.
export const fetchCartPricing = async (items, customer, pos_profile, coupon_code) => {
	const response = await enginePost("/api/method/easy_pos.api.pricing.get_cart_pricing", {
		items: JSON.stringify(items),
		customer: customer || undefined,
		pos_profile,
		coupon_code: coupon_code || undefined,
	});
	return response.data.message;
};

// Once-per-shift snapshot of Item Code/Item Group-scoped Selling Pricing
// Rules, fetched at shift-open (posSessionStore.loadProfileDetails) and fed
// to utils/pricingEngine.js so the Cart can resolve rate/discount for every
// add-to-cart locally instead of calling fetchCartPricing above. See
// easy_pos.api.pricing.get_pricing_rules for exactly what's/isn't covered.
export const fetchPricingRules = async (pos_profile) => {
	if (!pos_profile) return [];
	try {
		const response = await engineGet("/api/method/easy_pos.api.pricing.get_pricing_rules", {
			params: { pos_profile },
		});
		return response.data.message ?? [];
	} catch (error) {
		console.error(error);
		return [];
	}
};
