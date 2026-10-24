import { fetchList } from "./ListView";

const INVOICE_FIELDS = [
	"name",
	"posting_date",
	"customer",
	"customer_name",
	"grand_total",
	"status",
	"docstatus",
	"pos_profile",
];

const STATUS_TO_DOCSTATUS = { Draft: 0, Submitted: 1, Cancelled: 2 };

export const fetchInvoices = async (filters = {}, limit_start = 0, limit_page_length = 20) => {
	const conditions = { is_pos: 1 };

	if (filters.pos_profile) conditions.pos_profile = filters.pos_profile;
	if (filters.customer) conditions.customer = filters.customer;
	if (filters.mobile_no) conditions.contact_mobile = ["like", `%${filters.mobile_no}%`];
	if (filters.email) conditions.contact_email = ["like", `%${filters.email}%`];
	if (filters.status in STATUS_TO_DOCSTATUS) {
		conditions.docstatus = STATUS_TO_DOCSTATUS[filters.status];
	} else if (filters.status) {
		conditions.status = filters.status;
	}
	if (filters.from_date && filters.to_date) {
		conditions.posting_date = ["between", [filters.from_date, filters.to_date]];
	}

	const data = await fetchList("Sales Invoice", {
		fields: INVOICE_FIELDS,
		filters: conditions,
		order_by: "posting_date desc, creation desc",
		limit_start,
		limit_page_length,
	});

	return { invoices: data?.data ?? [], total_count: data?.total_count ?? 0 };
};
