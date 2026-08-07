import { create } from "zustand";
import axios from "../api/config";

const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 5000;

// Tracks live connectivity to the Frappe server (not just the OS network
// adapter) — a till can report "online" to the browser while the site itself
// is unreachable (VPN hiccup, server restart), and vice versa on some
// captive/proxied networks. `engine/index.js`'s engineCall reads this to
// decide server vs. local-DB per request.
const useConnectivityStore = create((set) => ({
	isOnline: typeof navigator === "undefined" || navigator.onLine,
	setOnline: (isOnline) => set((state) => (state.isOnline === isOnline ? state : { isOnline })),
}));

const heartbeat = async () => {
	try {
		// frappe.ping (allow_guest, GET /api/method/ping) — the lightest possible
		// round-trip to prove the server is actually reachable, not just "the OS
		// thinks the network is up". Bypasses the engine layer entirely (calling
		// axios directly): a heartbeat must never itself be routed to the local DB.
		await axios.get("/api/method/ping", { timeout: HEARTBEAT_TIMEOUT_MS });
		useConnectivityStore.getState().setOnline(true);
	} catch {
		useConnectivityStore.getState().setOnline(false);
	}
};

let heartbeatTimer = null;

// Wires the browser's online/offline events (fast path for an actual network
// adapter change) plus a periodic heartbeat ping (catches the cases those
// events miss — see above). Safe to call once at app boot (see initEngine);
// calling again just restarts the same interval instead of stacking listeners twice.
export const initConnectivity = () => {
	if (typeof window === "undefined") return;
	window.removeEventListener("online", heartbeat);
	window.addEventListener("online", heartbeat);
	window.removeEventListener("offline", handleOffline);
	window.addEventListener("offline", handleOffline);
	if (heartbeatTimer) clearInterval(heartbeatTimer);
	heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
	heartbeat();
};

function handleOffline() {
	useConnectivityStore.getState().setOnline(false);
}

export default useConnectivityStore;
