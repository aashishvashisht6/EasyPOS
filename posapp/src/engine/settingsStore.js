import { create } from "zustand";
import { fetchEasyposSettings } from "../api/Settings";
import db from "./db";

// Cache key in db.meta for the offline-mode flag itself (not a synced
// master-data domain, but stored the same way: { key, ...value }).
const SETTINGS_CACHE_KEY = "engineSettings";

const useEngineSettingsStore = create((set) => ({
	offlineModeEnabled: false,
	loaded: false,

	loadSettings: async () => {
		// Seed from the last known value first: if the device is already offline
		// at boot, the live fetch below fails, and with no local fallback the
		// engine would default to "offline mode off" and every page would keep
		// trying (and failing against) the server instead of reading local data.
		const cached = await db.meta.get(SETTINGS_CACHE_KEY);
		if (cached) set({ offlineModeEnabled: !!cached.offlineModeEnabled, loaded: true });

		const settings = await fetchEasyposSettings();
		if (settings === undefined) return; // live fetch failed — keep the cached value

		const offlineModeEnabled = !!settings.enable_offline_mode;
		set({ offlineModeEnabled, loaded: true });
		await db.meta.put({ key: SETTINGS_CACHE_KEY, offlineModeEnabled });
	},
}));

export default useEngineSettingsStore;
