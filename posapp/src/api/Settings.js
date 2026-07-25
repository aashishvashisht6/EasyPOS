import { engineGet } from "../engine";

export const fetchEasyposSettings = async () => {
	try {
		const response = await engineGet("/api/method/easy_pos.api.settings.get_easypos_settings");
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
