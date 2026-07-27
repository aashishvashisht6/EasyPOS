import { engineGet, enginePost } from "../engine";

// scope: "shift" | "today" | "range". opening_entry required for "shift";
// pos_profile/from_date/to_date apply to "today"/"range" (scoped server-side
// to the logged-in cashier's own invoices — see easy_pos.api.pos.get_sales_report).
export const fetchSalesReport = async ({ scope, opening_entry, pos_profile, from_date, to_date }) => {
	try {
		const response = await enginePost("/api/method/easy_pos.api.pos.get_sales_report", {
			scope,
			opening_entry,
			pos_profile,
			from_date,
			to_date,
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

// Closed shifts (EP Opening Entry) belonging to the logged-in cashier, most
// recent first — feeds the Reports page's shift picker.
export const fetchPastShifts = async (limit = 30) => {
	try {
		const response = await engineGet("/api/method/easy_pos.api.pos.get_past_shifts", {
			params: { limit },
		});
		return response.data.message ?? [];
	} catch (error) {
		console.error(error);
		return [];
	}
};
