import axios from "axios";
import { fetchList } from "./ListView";

const CUSTOMER_FIELDS = [
	"name",
	"customer_name",
	"customer_group",
	"territory",
	"mobile_no",
	"email_id",
	"disabled",
];

export const fetchCustomers = async (filters = {}, limit_start = 0, limit_page_length = 20) => {
	const conditions = {};
	const orConditions = {};

	if (filters.status === "Active") conditions.disabled = 0;
	else if (filters.status === "Inactive") conditions.disabled = 1;
	if (filters.customer_group) conditions.customer_group = filters.customer_group;
	if (filters.territory) conditions.territory = filters.territory;
	if (filters.mobile_no) conditions.mobile_no = ["like", `%${filters.mobile_no}%`];
	if (filters.email_id) conditions.email_id = ["like", `%${filters.email_id}%`];
	if (filters.search) {
		const term = `%${filters.search}%`;
		orConditions.customer_name = ["like", term];
		orConditions.mobile_no = ["like", term];
		orConditions.email_id = ["like", term];
	}

	const data = await fetchList("Customer", {
		fields: CUSTOMER_FIELDS,
		filters: conditions,
		or_filters: orConditions,
		order_by: "customer_name asc",
		limit_start,
		limit_page_length,
	});

	return { customers: data?.data ?? [], total_count: data?.total_count ?? 0 };
};

export const fetchCustomerGroups = async () => {
	try {
		const response = await axios.get("/api/method/frappe.desk.reportview.get_list", {
			params: {
				doctype: "Customer Group",
				filters: JSON.stringify({ is_group: 0 }),
				fields: JSON.stringify(["name"]),
				limit: 200,
			},
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const fetchTerritories = async () => {
	try {
		const response = await axios.get("/api/method/frappe.desk.reportview.get_list", {
			params: {
				doctype: "Territory",
				filters: JSON.stringify({ is_group: 0 }),
				fields: JSON.stringify(["name"]),
				limit: 200,
			},
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const createCustomer = async (customer) => {
	const response = await axios.post("/api/method/frappe.client.insert", {
		doc: JSON.stringify({ doctype: "Customer", ...customer }),
	});
	return response.data.message;
};
