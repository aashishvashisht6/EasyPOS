import { engineGet, enginePost } from "../engine";
import { fetchList } from "./ListView";

const LOYALTY_PROGRAM_FIELDS = [
	"name",
	"loyalty_program_name",
	"loyalty_program_type",
	"from_date",
	"to_date",
	"customer_group",
	"customer_territory",
	"conversion_factor",
	"company",
];

export const fetchLoyaltyPrograms = async (
	filters = {},
	limit_start = 0,
	limit_page_length = 20
) => {
	const conditions = {};
	const orConditions = {};

	if (filters.company) conditions.company = filters.company;
	if (filters.type) conditions.loyalty_program_type = filters.type;
	if (filters.search) orConditions.loyalty_program_name = ["like", `%${filters.search}%`];

	const data = await fetchList("Loyalty Program", {
		fields: LOYALTY_PROGRAM_FIELDS,
		filters: conditions,
		or_filters: orConditions,
		order_by: "loyalty_program_name asc",
		limit_start,
		limit_page_length,
	});

	return { programs: data?.data ?? [], total_count: data?.total_count ?? 0 };
};

export const fetchLoyaltyProgram = async (name) => {
	try {
		const response = await engineGet("/api/method/frappe.client.get", {
			params: { doctype: "Loyalty Program", name },
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const createLoyaltyProgram = async (program) => {
	const response = await enginePost("/api/method/frappe.client.insert", {
		doc: JSON.stringify({ doctype: "Loyalty Program", ...program }),
	});
	return response.data.message;
};

export const saveLoyaltyProgram = async (program) => {
	const response = await enginePost("/api/method/frappe.client.save", {
		doc: JSON.stringify({ doctype: "Loyalty Program", ...program }),
	});
	return response.data.message;
};

// Selected customer's live points balance + program terms, for the POS
// terminal's redeem-at-payment UI (easy_pos.api.loyalty.get_customer_loyalty_summary).
export const fetchCustomerLoyaltySummary = async (customer, company) => {
	if (!customer) return null;
	try {
		const response = await engineGet(
			"/api/method/easy_pos.api.loyalty.get_customer_loyalty_summary",
			{
				params: { customer, company },
			}
		);
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
