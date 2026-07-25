import { enginePost } from "../engine";

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
