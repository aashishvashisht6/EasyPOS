import { engineGet, enginePost } from "../engine";
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
		const response = await engineGet("/api/method/frappe.desk.reportview.get_list", {
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
		const response = await engineGet("/api/method/frappe.desk.reportview.get_list", {
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

export const fetchCustomer = async (name) => {
	try {
		const response = await engineGet("/api/method/frappe.client.get", {
			params: {
				doctype: "Customer",
				name,
			},
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const createCustomer = async (customer) => {
	const response = await enginePost("/api/method/frappe.client.insert", {
		doc: JSON.stringify({ doctype: "Customer", ...customer }),
	});
	return response.data.message;
};

export const saveCustomer = async (customer) => {
	const response = await enginePost("/api/method/frappe.client.save", {
		doc: JSON.stringify({ doctype: "Customer", ...customer }),
	});
	return response.data.message;
};

const linkedToCustomer = (customerName) => [
	["Dynamic Link", "link_doctype", "=", "Customer"],
	["Dynamic Link", "link_name", "=", customerName],
];

const ADDRESS_FIELDS = [
	"name",
	"address_title",
	"address_type",
	"address_line1",
	"address_line2",
	"city",
	"county",
	"state",
	"country",
	"pincode",
	"phone",
	"fax",
	"email_id",
	"is_primary_address",
	"is_shipping_address",
	"disabled",
];

const CONTACT_FIELDS = [
	"name",
	"first_name",
	"last_name",
	"email_id",
	"phone",
	"mobile_no",
	"designation",
	"department",
	"company_name",
	"is_primary_contact",
];

export const fetchCustomerAddresses = async (customerName) => {
	const data = await fetchList("Address", {
		fields: ADDRESS_FIELDS,
		filters: linkedToCustomer(customerName),
		order_by: "is_primary_address desc, `tabAddress`.creation asc",
		limit_page_length: 0,
	});
	return data?.data ?? [];
};

export const fetchCustomerContacts = async (customerName) => {
	const data = await fetchList("Contact", {
		fields: CONTACT_FIELDS,
		filters: linkedToCustomer(customerName),
		order_by: "is_primary_contact desc, `tabContact`.creation asc",
		limit_page_length: 0,
	});
	return data?.data ?? [];
};

export const fetchAddress = async (name) => {
	const response = await engineGet("/api/method/frappe.client.get", {
		params: { doctype: "Address", name },
	});
	return response.data.message;
};

export const fetchContact = async (name) => {
	const response = await engineGet("/api/method/frappe.client.get", {
		params: { doctype: "Contact", name },
	});
	return response.data.message;
};

export const createAddress = async (customerName, address) => {
	const response = await enginePost("/api/method/frappe.client.insert", {
		doc: JSON.stringify({
			doctype: "Address",
			...address,
			links: [{ link_doctype: "Customer", link_name: customerName }],
		}),
	});
	return response.data.message;
};

export const saveAddress = async (address) => {
	const response = await enginePost("/api/method/frappe.client.save", {
		doc: JSON.stringify({ doctype: "Address", ...address }),
	});
	return response.data.message;
};

export const deleteAddress = async (name) => {
	await enginePost("/api/method/frappe.client.delete", { doctype: "Address", name });
};

export const createContact = async (customerName, contact) => {
	const response = await enginePost("/api/method/frappe.client.insert", {
		doc: JSON.stringify({
			doctype: "Contact",
			...contact,
			links: [{ link_doctype: "Customer", link_name: customerName }],
		}),
	});
	return response.data.message;
};

export const saveContact = async (contact) => {
	const response = await enginePost("/api/method/frappe.client.save", {
		doc: JSON.stringify({ doctype: "Contact", ...contact }),
	});
	return response.data.message;
};

export const deleteContact = async (name) => {
	await enginePost("/api/method/frappe.client.delete", { doctype: "Contact", name });
};

export const fetchAddressDisplay = async (addressName) => {
	try {
		const response = await engineGet(
			"/api/method/frappe.contacts.doctype.address.address.get_address_display",
			{ params: { address_dict: addressName } },
		);
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
