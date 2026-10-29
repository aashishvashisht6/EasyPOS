import { engineGet, enginePost } from "../engine";

// The user-facing message of a frappe.throw() (double-JSON-encoded in
// _server_messages), or a fixed one for the endpoint's rate limit (HTTP 429,
// which carries no server message).
const toUserError = (error, fallback) => {
	if (error?.response?.status === 429) {
		return new Error("Too many attempts — wait a few minutes and try again.");
	}
	const serverMessages = error?.response?.data?._server_messages;
	if (serverMessages) {
		try {
			const message = JSON.parse(JSON.parse(serverMessages)[0])?.message;
			if (message) return new Error(message);
		} catch {
			// fall through to the fallback below
		}
	}
	return new Error(fallback);
};

// Errors propagate (no swallow-and-return-undefined) so CashMovementModal can
// show why loading or recording failed — e.g. a rejected manager approval.
export const fetchCashMovements = async (opening_entry) => {
	try {
		const response = await engineGet("/api/method/easy_pos.api.cash_movement.get_cash_movements", {
			params: { opening_entry },
		});
		return response.data.message;
	} catch (error) {
		throw toUserError(error, "Could not load this shift's cash movements.");
	}
};

export const createCashMovement = async (payload) => {
	try {
		const response = await enginePost("/api/method/easy_pos.api.cash_movement.create_cash_movement", payload);
		return response.data.message;
	} catch (error) {
		throw toUserError(error, "Could not record the cash movement.");
	}
};
