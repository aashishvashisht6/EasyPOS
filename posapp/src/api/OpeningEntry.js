import { engineGet, enginePost } from "../engine";
import db from "../engine/db";

// Cache key prefix in db.meta — must match localReads.js's readCheckOpeningEntry.
// Without this, a refresh while offline loses shift state entirely (this call
// fails, hasOpeningEntry resets to false), even mid-shift with items already
// rung up — the terminal would prompt to open a new shift on top of an
// already-open one.
const openingEntryCacheKey = (user) => `openingEntry:${user}`;

export const fetchOpeningEntry = async (user) => {
	try {
		const response = await engineGet("/api/method/easy_pos.api.pos.check_opening_entry", {
			params: {
				user,
			},
		});
		const data = response.data.message;
		await db.meta.put({ key: openingEntryCacheKey(user), data });
		return data;
	} catch (error) {
		console.error(error);
	}
};

export const postOpeningEntry = async (opening_details) => {
	const response = await enginePost("/api/method/easy_pos.api.pos.create_opening_entry", {
		opening_details,
	});
	return response.data.message;
};
