import { flt } from "./number";

// Client-side port of how ERPNext resolves Selling Pricing Rules for one cart
// line, so the Cart can price every add-to-cart locally — including while the
// till is offline — instead of calling easy_pos.api.pricing.get_cart_pricing.
//
// It mirrors, in order:
//   erpnext.accounts.doctype.pricing_rule.utils.get_pricing_rules   (candidates)
//   ...utils.filter_pricing_rules                                    (qty/amount, priority, conflicts)
//   ...pricing_rule.get_pricing_rule_for_item / apply_price_discount_rule  (application)
//   ...utils.get_product_discount_rule                               (free items)
// against the snapshot from easy_pos.api.pricing.get_pricing_rules (cached on
// posSessionStore.pricingRules). Group scoping arrives pre-expanded to the
// whole subtree, so every lookup here is an exact `includes`.
//
// Returns null whenever a rule that could apply to a line uses something this
// port can't evaluate (`needs_server`: mixed conditions, cumulative, ...) or a
// typed coupon code isn't in the snapshot; the caller then falls back to
// get_cart_pricing online, or warns offline.
//
// Quirks of ERPNext reproduced on purpose, because the server re-prices the
// invoice on sync and the till must show the same number:
//  - `priority` is a text field; candidates are ordered by it as text, but the
//    winner is chosen by its integer value.
//  - A rule scoped to Item Code stops the search before Item Group/Brand rules
//    unless the rule has a priority.
//  - A coupon-based rule can win the priority contest and then be skipped for
//    lack of a coupon, masking the lower-priority rules that lost to it.
//  - Rules tying on every criterion are a conflict: no discount, with ERPNext's
//    "Multiple Price Rules exists" message on the line.

const num = (v) => {
	const n = typeof v === "number" ? v : parseFloat(v);
	return Number.isNaN(n) ? 0 : n;
};
const int = (v) => Math.trunc(num(v));

const APPLY_ON_ORDER = ["Item Code", "Item Group", "Brand"];

// ERPNext sorts `priority desc, name desc` in SQL; priority is a Data/Select
// string, so "9" sorts above "10".
const byPriorityThenName = (a, b) => {
	const pa = String(a.priority ?? "");
	const pb = String(b.priority ?? "");
	if (pa !== pb) return pa < pb ? 1 : -1;
	return a.name < b.name ? 1 : -1;
};

const matchesApplyOn = (rule, line, applyOn) => {
	if (rule.apply_on !== applyOn) return false;
	if (applyOn === "Item Code")
		return (
			(rule.item_codes || []).includes(line.item_code) ||
			(!!line.variant_of && (rule.item_codes || []).includes(line.variant_of))
		);
	if (applyOn === "Item Group") return (rule.item_groups || []).includes(line.item_group);
	return !!line.brand && (rule.brands || []).includes(line.brand);
};

// get_other_conditions: a blank-scoped rule always passes; a scoped one needs
// the cart to carry the same value. With no customer, only unscoped rules.
const matchesContext = (rule, ctx) => {
	if (ctx.customer ? rule.customer && rule.customer !== ctx.customer : rule.customer)
		return false;
	// Group scoping (_get_tree_conditions): a rule scoped to a group matches a
	// cart whose group sits anywhere under it; a cart with no group (no customer
	// selected) only matches unscoped rules.
	if (
		rule.customer_group &&
		!(ctx.customerGroup && (rule.customer_group_tree || []).includes(ctx.customerGroup))
	)
		return false;
	if (rule.territory && !(ctx.territory && (rule.territory_tree || []).includes(ctx.territory)))
		return false;
	if (rule.valid_from && ctx.today < rule.valid_from) return false;
	if (rule.valid_upto && ctx.today > rule.valid_upto) return false;
	return true;
};

const passesQtyAmount = (rule, qty, amount) => {
	if (!(qty >= num(rule.min_qty) && (rule.max_qty ? qty <= num(rule.max_qty) : true)))
		return false;
	return amount >= num(rule.min_amt) && (rule.max_amt ? amount <= num(rule.max_amt) : true);
};

class PricingConflict extends Error {}

// filter_pricing_rules for a list of rules: returns the one winning rule, or
// null. Throws PricingConflict when several tie on every criterion.
const pickRule = (rules, line, ctx) => {
	const qty = num(line.qty);
	const amount = num(line.price_list_rate) * qty;
	let rs = rules.filter((r) => passesQtyAmount(r, qty, amount));

	if (rs.length > 1) {
		const sameCurrency = rs.filter((r) => (r.currency || "") === (ctx.currency || ""));
		if (sameCurrency.length) rs = sameCurrency;
	}
	if (rs.length) {
		const max = Math.max(...rs.map((r) => int(r.priority)));
		if (max) rs = rs.filter((r) => int(r.priority) === max);
	}
	if (rs.length > 1) {
		const kinds = new Set(rs.map((r) => r.rate_or_discount));
		if (kinds.size === 1 && kinds.has("Discount Percentage"))
			rs = rs.filter((r) => r.for_price_list === ctx.priceList).length
				? rs.filter((r) => r.for_price_list === ctx.priceList)
				: rs;
	}
	if (rs.length > 1)
		throw new PricingConflict(
			`Multiple Price Rules exists with same criteria, please resolve conflict by assigning priority. Price Rules: ${rs
				.map((r) => r.name)
				.join("\n")}`
		);
	return rs[0] || null;
};

// get_pricing_rules: collect candidates per apply_on, then choose.
const selectRules = (line, rules, ctx) => {
	let candidates = [];
	let needsServer = false;
	for (const applyOn of APPLY_ON_ORDER) {
		const rows = rules
			.filter((r) => matchesApplyOn(r, line, applyOn) && matchesContext(r, ctx))
			.sort(byPriorityThenName);
		candidates = candidates.concat(rows);
		if (rows.some((r) => r.needs_server)) needsServer = true;
		if (candidates.length && candidates[0].priority) continue;
		if (candidates.length && !candidates.every((r) => r.apply_multiple_pricing_rules)) break;
	}
	if (needsServer) return { needsServer: true, rules: [] };
	if (!candidates.length) return { rules: [] };

	if (candidates.every((r) => r.apply_multiple_pricing_rules)) {
		// sorted_by_priority: every rule that survives its own qty/amount check,
		// applied in ascending priority (a blank priority counts as 1).
		const kept = candidates.filter((r) => pickRule([r], line, ctx));
		kept.sort((a, b) => (int(a.priority) || 1) - (int(b.priority) || 1));
		return { rules: kept };
	}
	const winner = pickRule(candidates, line, ctx);
	return { rules: winner ? [winner] : [] };
};

// get_product_discount_rule: free-item quantity for one matched rule.
const freeItemFor = (rule, line, itemMeta) => {
	const freeCode =
		(rule.same_item && rule.apply_on !== "Transaction" ? line.item_code : null) ||
		rule.free_item;
	if (!freeCode) return null;

	let qty = num(rule.free_qty) || 1;
	if (rule.is_recursive) {
		let transactionQty = num(line.qty) - num(rule.apply_recursion_over);
		if (transactionQty > 0) {
			qty = (transactionQty * qty) / num(rule.recurse_for);
			if (rule.round_free_qty)
				qty =
					Math.floor(transactionQty / num(rule.recurse_for)) * (num(rule.free_qty) || 1);
		}
	}
	if (!qty) return null;

	const meta = itemMeta?.(freeCode) || {};
	return {
		item_code: freeCode,
		item_name: meta.item_name || freeCode,
		qty,
		rate: num(rule.free_item_rate),
		uom: meta.stock_uom,
		pricing_rules: rule.name,
		is_free_item: 1,
	};
};

// Resolves a typed coupon code against the snapshot: {name} of the Coupon Code
// doc, null when unknown (caller falls back to the server), or throws the same
// refusals erpnext...utils.validate_coupon_code does.
const resolveCoupon = (code, rules, today) => {
	for (const rule of rules)
		for (const c of rule.coupon_codes || []) {
			if (c.name !== code && c.coupon_code !== code) continue;
			if (c.valid_from && c.valid_from > today)
				throw Object.assign(
					new Error("Sorry, the validity of this coupon code has not started"),
					{ coupon: true }
				);
			if (c.valid_upto && c.valid_upto < today)
				throw Object.assign(new Error("Sorry, this coupon code has expired"), {
					coupon: true,
				});
			if (num(c.maximum_use) && num(c.used) >= num(c.maximum_use))
				throw Object.assign(new Error("Sorry, this coupon code is no longer valid"), {
					coupon: true,
				});
			return c.name;
		}
	return null;
};

// `items`: cart lines — item_code, item_group, brand, qty, price_list_rate.
// `ctx`: { customer, customerGroup, territory, currency, priceList, couponCode,
//          ignorePricingRule, itemMeta(code) -> {item_name, stock_uom}, today }.
// Returns the get_cart_pricing shape ({ items, free_items }) or null.
export const computeCartPricingLocally = (items, pricingRules, ctx, precision = 2) => {
	const today = ctx.today || new Date().toISOString().slice(0, 10);
	const rules = pricingRules || [];

	let couponName = null;
	if (ctx.couponCode) {
		couponName = resolveCoupon(ctx.couponCode, rules, today);
		if (!couponName) return null;
	}

	const results = [];
	const freeItems = new Map();

	for (const line of items) {
		const plr0 = flt(line.price_list_rate, precision);
		const entry = {
			item_code: line.item_code,
			qty: line.qty,
			price_list_rate: plr0,
			rate: plr0,
			discount_percentage: 0,
			discount_amount: 0,
			pricing_rules: [],
			has_pricing_rule: false,
			error: null,
		};

		let selected = [];
		if (!ctx.ignorePricingRule) {
			try {
				const sel = selectRules({ ...line, price_list_rate: plr0 }, rules, {
					...ctx,
					today,
				});
				if (sel.needsServer) return null;
				selected = sel.rules;
			} catch (e) {
				if (!(e instanceof PricingConflict)) throw e;
				entry.error = e.message;
			}
		}

		let listRate = plr0;
		let pct = 0;
		let amt = 0;
		const applied = [];
		for (const rule of selected) {
			if (int(rule.coupon_code_based) === 1) {
				if (!couponName) continue;
				if (!(rule.coupon_codes || []).some((c) => c.name === couponName)) continue;
			}
			applied.push(rule.name);

			if (rule.price_or_product_discount === "Product") {
				const free = freeItemFor(rule, line, ctx.itemMeta);
				if (free) {
					const key = `${free.item_code}|${free.pricing_rules}`;
					if (!freeItems.has(key)) freeItems.set(key, free);
				}
				continue;
			}

			if (rule.rate_or_discount === "Rate") {
				const r = rule.currency_matches === false ? 0 : num(rule.rate);
				if (r) {
					listRate = flt(r, precision);
					pct = 0;
				}
			} else if (rule.rate_or_discount === "Discount Percentage") {
				if (rule.apply_discount_on_rate && pct)
					pct += (100 - pct) * (num(rule.discount_percentage) / 100);
				else if (plr0) {
					amt += plr0 * (num(rule.discount_percentage) / 100);
					pct = amt ? (amt / plr0) * 100 : pct;
				} else pct += num(rule.discount_percentage);
			} else if (rule.rate_or_discount === "Discount Amount") {
				if (rule.apply_discount_on_rate && pct)
					amt += (100 - amt) * (num(rule.discount_amount) / 100);
				else amt += num(rule.discount_amount);
			}
		}

		// easy_pos.api.pricing._effective_rate
		let rate = listRate;
		let discountAmount = 0;
		if (pct === 100) {
			rate = 0;
			discountAmount = listRate;
		} else if (pct) {
			rate = flt(listRate * (1 - pct / 100), precision);
			discountAmount = flt(listRate - rate, precision);
		} else if (amt) {
			rate = flt(listRate - amt, precision);
			discountAmount = flt(amt, precision);
		}

		Object.assign(entry, {
			price_list_rate: listRate,
			rate: flt(Math.max(rate, 0), precision),
			discount_percentage: pct,
			discount_amount: discountAmount,
			pricing_rules: applied,
			has_pricing_rule: applied.length > 0,
		});
		results.push(entry);
	}

	return { items: results, free_items: [...freeItems.values()] };
};
