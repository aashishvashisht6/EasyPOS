export const formatDate = (value) => {
	if (!value) return "";
	return new Date(value).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
};

// Sales Invoice status -> pos-badge-* modifier class (see theme/components.css).
export const invoiceStatusBadgeClass = (status) => {
	switch (status) {
		case "Paid":
			return "pos-badge pos-badge-paid";
		case "Unpaid":
		case "Unpaid and Discounted":
			return "pos-badge pos-badge-unpaid";
		case "Overdue":
		case "Overdue and Discounted":
			return "pos-badge pos-badge-overdue";
		default:
			return "pos-badge";
	}
};
