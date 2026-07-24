import axios from "axios";

export const fetchCsrfToken = async () => {
	const response = await axios.get("/api/method/easy_pos.api.auth.get_csrf_token");
	return response.data.message;
};

export const postPosLogin = async (usr, pwd) => {
	const response = await axios.post("/api/method/easy_pos.api.auth.pos_login", {
		usr,
		pwd,
	});
	return response.data.message;
};
