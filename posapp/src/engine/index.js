import axios from "../api/config";
import db from "./db";
import useEngineSettingsStore from "./settingsStore";

// Middleware every api/*.js call routes through instead of calling axios
// directly. Decides server vs. local DB per call; for now the local-DB
// branch is a real code path but unreachable in practice, since offline
// reads/writes aren't implemented yet (see CLAUDE.md/plan) — offlineModeEnabled
// being true just means every capable call throws instead of silently
// pretending to work, rather than actually falling back to the server.
const OFFLINE_CAPABLE_DOCTYPES = [
	"Item",
	"Item Group",
	"Customer",
	"Price List",
	"Pricing Rule",
	"Sales Taxes and Charges Template",
	"POS Profile",
	"Mode of Payment",
];

const isOfflineCapable = (doctype) => !!doctype && OFFLINE_CAPABLE_DOCTYPES.includes(doctype);

// Best-effort doctype extraction from a call's params/data, used only to
// decide offline-capability — call sites don't need to pass it explicitly.
const extractDoctype = ({ params, data } = {}) => {
	if (params?.doctype) return params.doctype;
	if (data?.doctype) return data.doctype;
	if (typeof data?.doc === "string") {
		try {
			return JSON.parse(data.doc).doctype;
		} catch {
			return undefined;
		}
	}
	return undefined;
};

const readFromLocalDB = async () => {
	throw new Error("Offline reads are not implemented yet");
};

// Returns the same shape as axios.get/axios.post (a response object with
// `.data`), so callers keep using `response.data.message` unchanged.
const callServer = ({ url, method = "get", params, data }) =>
	axios.request({ url, method, params, data });

export const engineCall = ({ url, method = "get", params, data, doctype }) => {
	const { offlineModeEnabled } = useEngineSettingsStore.getState();
	const resolvedDoctype = doctype ?? extractDoctype({ params, data });

	if (offlineModeEnabled && isOfflineCapable(resolvedDoctype)) {
		return readFromLocalDB();
	}

	return callServer({ url, method, params, data });
};

export const engineGet = (url, config = {}) =>
	engineCall({ url, method: "get", params: config.params });

export const enginePost = (url, data = {}) => engineCall({ url, method: "post", data });

// Opens the local Dexie database and loads the offline-mode flag from the
// backend. Safe to call once at app boot; does not affect any existing page.
export const initEngine = async () => {
	await db.open();
	await useEngineSettingsStore.getState().loadSettings();
};
