import { enginePost } from "../engine";

/**
 * Generic paginated list fetch shared by all POS list-view pages
 * (Invoices, Customers, ...). Mirrors easy_pos.api.list_view.get_list.
 *
 * filters/or_filters: dict of {fieldname: value} or {fieldname: [operator, value]},
 * matching Frappe's standard filter shape.
 *
 * Returns { data: [], total_count: number }.
 */
export const fetchList = async (doctype, options = {}) => {
	const {
		fields = ["name"],
		filters = {},
		or_filters = {},
		order_by,
		limit_start = 0,
		limit_page_length = 20,
	} = options;

	try {
		const response = await enginePost("/api/method/easy_pos.api.list_view.get_list", {
			doctype,
			fields,
			filters,
			or_filters,
			order_by,
			limit_start,
			limit_page_length,
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
		return { data: [], total_count: 0 };
	}
};
