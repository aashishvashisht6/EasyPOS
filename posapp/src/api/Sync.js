import { engineGet } from "../engine";

// Full master-data bundle for offline caching — see easy_pos.api.sync.get_offline_snapshot.
// Unlike most api/*.js reads, this deliberately does NOT try/catch-and-swallow: a failed
// sync needs to surface to the Sync page (see engine/sync.js's runFullSync), same reasoning
// as Invoice.js's cancelInvoice/createCreditNote. It also always goes to the server —
// there's no "doctype" for the engine to route on, and this call is the one that fills the
// offline cache in the first place, so it can never be served from it.
export const fetchOfflineSnapshot = async (pos_profile) => {
	const response = await engineGet("/api/method/easy_pos.api.sync.get_offline_snapshot", {
		params: { pos_profile },
	});
	return response.data.message;
};
