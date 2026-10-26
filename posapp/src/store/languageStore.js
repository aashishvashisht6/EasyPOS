import { create } from "zustand";
import { LANGUAGES, languageDir, setLanguage as setTranslationLanguage } from "../translation";
import { loadTranslations } from "../translation/loader";
import { applyBootstrapDirection } from "../theme/bootstrapDirection";

const STORAGE_KEY = "easy-pos-language";

// "pt-BR" / "pt_br" -> "pt-BR" (an exact regional match wins), "hi-IN" -> "hi"
// (else the base language) when the UI offers it, else null.
const toSupported = (code) => {
	if (!code) return null;
	const normalized = String(code).toLowerCase().replace("_", "-");
	const exact = LANGUAGES.find((l) => l.code.toLowerCase() === normalized);
	if (exact) return exact.code;
	const base = normalized.split("-")[0];
	return LANGUAGES.some((l) => l.code === base) ? base : null;
};

const readStored = () => {
	try {
		return toSupported(localStorage.getItem(STORAGE_KEY));
	} catch {
		return null;
	}
};

// Returns a promise for the direction's Bootstrap stylesheet and the
// language's translations (main.jsx waits on the first one before mounting,
// so an RTL till never flashes LTR or untranslated English).
const applyLanguage = (language) => {
	const dir = languageDir(language);
	setTranslationLanguage(language);
	document.documentElement.setAttribute("lang", language);
	document.documentElement.setAttribute("dir", dir);
	return Promise.all([applyBootstrapDirection(dir), loadTranslations(language)]);
};

// Device-scoped (localStorage), same as themeStore — the till's own setting.
// Until a cashier picks one here, it follows the Frappe user's language
// (window.pos_boot.lang, or the login response's `language`).
const useLanguageStore = create((set, get) => ({
	language: readStored() || toSupported(window.pos_boot?.lang) || "en",
	// true once the cashier explicitly chose a language on this device.
	chosen: !!readStored(),

	setLanguage: (language) => {
		const supported = toSupported(language) || "en";
		try {
			localStorage.setItem(STORAGE_KEY, supported);
		} catch {
			// private mode / blocked storage — still switch for this session
		}
		applyLanguage(supported);
		set({ language: supported, chosen: true });
	},

	// Applies the logged-in user's Frappe language, unless this device already
	// has an explicit choice.
	applyUserLanguage: (language) => {
		const supported = toSupported(language);
		if (get().chosen || !supported || supported === get().language) return;
		applyLanguage(supported);
		set({ language: supported });
	},
}));

export const languageReady = applyLanguage(useLanguageStore.getState().language);

// Record-value translations (item names, payment modes...) are only returned
// to a logged-in session — re-fetch once one exists (called after login /
// session check, see authStore).
export const refreshTranslations = () => loadTranslations(useLanguageStore.getState().language);

// Keeps other windows of this app on the same device (e.g. the Customer
// Display second screen) in step when the cashier switches language.
window.addEventListener("storage", (event) => {
	if (event.key !== STORAGE_KEY) return;
	const next = toSupported(event.newValue);
	if (!next || next === useLanguageStore.getState().language) return;
	applyLanguage(next);
	useLanguageStore.setState({ language: next, chosen: true });
});

export default useLanguageStore;
