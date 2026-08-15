import { flt } from "./number";

// Client-side re-implementation of easy_pos.api.pricing.get_cart_pricing's
// per-line rate/discount resolution, run against the once-per-shift Pricing
// Rule snapshot (api/Pricing.js's fetchPricingRules, cached on
// posSessionStore.pricingRules) instead of hitting the server on every
// add-to-cart. Deliberately narrower than the backend: only Item Code /
// Item Group scoped, Price-type (Rate / Discount Percentage / Discount
// Amount) rules are resolved here. Whenever a cart line matches a Product
// Discount (free item) rule — which needs a server round trip to resolve
// free_item_data — computeCartPricingLocally returns null and the caller
// (Cart/index.jsx) falls back to fetchCartPricing for that pass, same as it
// already does whenever a coupon code is typed.

const dateInRange = (validFrom, validUpto, today) => {
	if (validFrom && today < validFrom) return false;
	if (validUpto && today > validUpto) return false;
	return true;
};

// today: "YYYY-MM-DD" string, so plain string comparison against Frappe's
// own Date field format works without a date-parsing dependency.
const ruleMatchesLine = (rule, line, ctx) => {
	if (rule.apply_on === "Item Code" && !(rule.item_codes || []).includes(line.item_code)) return false;
	if (rule.apply_on === "Item Group" && !(rule.item_groups || []).includes(line.item_group)) return false;

	if (rule.applicable_for === "Customer" && rule.customer !== ctx.customer) return false;
	if (rule.applicable_for === "Customer Group" && rule.customer_group !== ctx.customerGroup) return false;
	if (rule.applicable_for === "Territory" && rule.territory !== ctx.territory) return false;

	const qty = flt(line.qty);
	if (rule.min_qty && qty < flt(rule.min_qty)) return false;
	if (rule.max_qty && qty > flt(rule.max_qty)) return false;

	const amount = flt(qty * flt(line.price_list_rate));
	if (rule.min_amt && amount < flt(rule.min_amt)) return false;
	if (rule.max_amt && amount > flt(rule.max_amt)) return false;

	return dateInRange(rule.valid_from, rule.valid_upto, ctx.today);
};

// Same formula as pricing.py's _effective_rate.
const effectiveRate = (priceListRate, rule, precision) => {
	const discountPercentage = flt(rule.discount_percentage);
	const discountAmount = flt(rule.discount_amount);

	if (rule.rate_or_discount === "Rate") {
		const rate = flt(rule.rate, precision);
		return { rate, discountAmount: flt(priceListRate - rate, precision) };
	}
	if (rule.rate_or_discount === "Discount Percentage") {
		if (discountPercentage === 100) return { rate: 0, discountAmount: priceListRate };
		const rate = flt(priceListRate * (1 - discountPercentage / 100), precision);
		return { rate, discountAmount: flt(priceListRate - rate, precision) };
	}
	if (rule.rate_or_discount === "Discount Amount") {
		const rate = flt(priceListRate - discountAmount, precision);
		return { rate, discountAmount: flt(discountAmount, precision) };
	}
	return { rate: priceListRate, discountAmount: 0 };
};

// `items`: cart lines — needs item_code, item_group, qty, price_list_rate.
// `pricingRules`: posSessionStore.pricingRules (from fetchPricingRules).
// `ctx`: { customer, customerGroup, territory, today }.
// Returns the same { items, free_items } shape get_cart_pricing does, so
// cartStore.applyPricing needs no changes — or null when a Product Discount
// rule matched and the caller must fall back to the server.
export const computeCartPricingLocally = (items, pricingRules, ctx, precision = 2) => {
	const today = ctx.today || new Date().toISOString().slice(0, 10);
	const results = [];

	for (const line of items) {
		const matches = (pricingRules || []).filter((rule) => ruleMatchesLine(rule, line, { ...ctx, today }));
		if (matches.some((rule) => rule.price_or_product_discount === "Product")) return null;

		const priceListRate = flt(line.price_list_rate, precision);
		const priceRules = matches.filter((rule) => rule.price_or_product_discount === "Price");

		let rate = priceListRate;
		let discountAmount = 0;
		const appliedRuleNames = [];

		if (priceRules.length) {
			// Higher `priority` wins; without apply_multiple_pricing_rules only the
			// single highest-priority match applies (ties go to matched order,
			// same as ERPNext's own frappe.get_all default), otherwise every
			// matching rule stacks in priority order — mirrors get_item_details'
			// own apply_multiple_pricing_rules stacking behaviour.
			const sorted = [...priceRules].sort(
				(a, b) => (parseInt(b.priority, 10) || 0) - (parseInt(a.priority, 10) || 0),
			);
			const applyMultiple = sorted.some((rule) => rule.apply_multiple_pricing_rules);
			const chosen = applyMultiple ? sorted : sorted.slice(0, 1);

			let runningRate = priceListRate;
			for (const rule of chosen) {
				const effective = effectiveRate(runningRate, rule, precision);
				runningRate = effective.rate;
				appliedRuleNames.push(rule.name);
			}
			rate = flt(Math.max(runningRate, 0), precision);
			discountAmount = flt(priceListRate - rate, precision);
		}

		results.push({
			item_code: line.item_code,
			qty: line.qty,
			price_list_rate: priceListRate,
			rate,
			discount_percentage: priceListRate ? flt((discountAmount / priceListRate) * 100, 2) : 0,
			discount_amount: discountAmount,
			pricing_rules: appliedRuleNames,
			has_pricing_rule: appliedRuleNames.length > 0,
			error: null,
		});
	}

	return { items: results, free_items: [] };
};
