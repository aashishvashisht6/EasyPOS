// The user-facing message of a frappe.throw() from an axios error — Frappe
// sends it double-JSON-encoded in `_server_messages`. Returns "" for errors
// with no server message (e.g. offline / network failures).
export const getServerMessage = (error) => {
	const serverMessages = error?.response?.data?._server_messages;
	if (!serverMessages) return "";
	try {
		const message = JSON.parse(JSON.parse(serverMessages)[0])?.message || "";
		// frappe.throw messages often carry markup (<strong>, <br>) for desk; the
		// POS renders them as plain text.
		return message.replace(/<[^>]*>/g, "");
	} catch {
		return "";
	}
};
