import { engineGet, enginePost } from "../engine";

// Generic dispatcher endpoints — `gateway` selects which module
// easy_pos.api.payment_gateways routes to server-side (see that package's
// registry). Adding a new gateway never changes these signatures.

export const fetchPaymentGatewayConfig = async (gateway) => {
	try {
		const response = await engineGet(
			"/api/method/easy_pos.api.payment.get_payment_gateway_config",
			{
				params: { gateway },
			}
		);
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const createPaymentGatewayOrder = async (gateway, invoice, opening_details, amount) => {
	const response = await enginePost(
		"/api/method/easy_pos.api.payment.create_payment_gateway_order",
		{
			gateway,
			invoice,
			opening_details,
			amount,
		}
	);
	return response.data.message;
};

export const verifyPaymentGatewayOrder = async (gateway, sales_invoice, payload, coupon_code) => {
	const response = await enginePost(
		"/api/method/easy_pos.api.payment.verify_payment_gateway_order",
		{
			gateway,
			sales_invoice,
			payload,
			coupon_code,
		}
	);
	return response.data.message;
};
