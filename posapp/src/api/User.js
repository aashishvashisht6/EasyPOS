import { engineGet, enginePost } from "../engine";
import db from "../engine/db";

// Cache key in db.meta — must match localReads.js's readLoggedInUser. Session
// auth is cookie-based, so the cookie itself survives a refresh with no
// network call; this cache exists only so `checkSession` can still answer
// "who is logged in" while offline, instead of failing the live
// frappe.auth.get_logged_user round-trip and bouncing to the login page.
const LOGGED_IN_USER_KEY = "loggedInUser";

export const fetchLoggedInUser = async () => {
	try {
		const response = await engineGet("/api/method/frappe.auth.get_logged_user");
		const email = response.data.message;
		if (email) await db.meta.put({ key: LOGGED_IN_USER_KEY, email });
		return email;
	} catch (error) {
		console.error(error);
		return null;
	}
};

export const logOutUser = async () => {
	try {
		const response = await enginePost("/api/method/logout");
		return response.data.message;
	} catch (error) {
		console.error(error);
		return null;
	} finally {
		// Always clear the local identity on a logout attempt, even if the
		// network call itself failed (offline) — otherwise a later offline
		// refresh would resurrect the just-logged-out user from cache.
		await db.meta.delete(LOGGED_IN_USER_KEY);
	}
};
