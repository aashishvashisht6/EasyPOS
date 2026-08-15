import { create } from "zustand";
import { fetchLoggedInUser, logOutUser } from "../api/User";
import { postPosLogin } from "../api/Auth";

const useAuthStore = create((set) => ({
	user: null,
	loading: true,
	error: null,

	checkSession: async () => {
		const email = await fetchLoggedInUser();
		if (email) {
			const cookies = Object.fromEntries(
				document.cookie.split("; ").map((c) => c.split("="))
			);
			set({ user: { email, full_name: cookies?.full_name }, loading: false });
		} else {
			set({ user: null, loading: false });
		}
	},

	login: async (usr, pwd) => {
		set({ error: null });
		try {
			const data = await postPosLogin(usr, pwd);
			set({ user: { email: data.user, full_name: data.full_name } });
			return true;
		} catch (error) {
			const message =
				error?.response?.data?.message ||
				error?.response?.data?.exc_type ||
				"Invalid username or password";
			set({ error: message });
			return false;
		}
	},

	logout: async () => {
		await logOutUser();
		set({ user: null });
	},
}));

export default useAuthStore;
