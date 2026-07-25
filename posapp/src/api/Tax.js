import { engineGet } from "../engine";

// Resolved order-level tax rows (charge_type, account_head, rate, ...) for the
// POS Profile's default taxes_and_charges template — see
// easy_pos.api.pos.get_taxes_and_charges_template for why POS invoices need
// these fetched and passed through explicitly rather than relying on
// ERPNext's own auto-population.
export const fetchTaxesAndChargesTemplate = async (taxes_and_charges) => {
	if (!taxes_and_charges) return [];
	try {
		const response = await engineGet(
			"/api/method/easy_pos.api.pos.get_taxes_and_charges_template",
			{ params: { taxes_and_charges } },
		);
		return response.data.message ?? [];
	} catch (error) {
		console.error(error);
		return [];
	}
};
