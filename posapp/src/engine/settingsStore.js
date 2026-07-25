import { create } from "zustand";
import { fetchEasyposSettings } from "../api/Settings";

const useEngineSettingsStore = create((set) => ({
	offlineModeEnabled: false,
	loaded: false,

	loadSettings: async () => {
		const settings = await fetchEasyposSettings();
		set({
			offlineModeEnabled: !!settings?.enable_offline_mode,
			loaded: true,
		});
	},
}));

export default useEngineSettingsStore;
