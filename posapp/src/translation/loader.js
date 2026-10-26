import axios from "../api/config";
import { setMessages } from "./index";

const cacheKey = (language) => `easy-pos-translations-${language}`;

// Wait at most this long for the server before showing whatever we have
// (English fallback on a first-ever load while the server is slow/offline).
const FIRST_LOAD_TIMEOUT_MS = 4000;

const readCache = (language) => {
	try {
		return JSON.parse(localStorage.getItem(cacheKey(language)) || "null");
	} catch {
		return null;
	}
};

const writeCache = (language, translations) => {
	try {
		localStorage.setItem(cacheKey(language), JSON.stringify(translations));
	} catch {
		// storage full/blocked — the in-memory copy still applies this session
	}
};

const fetchTranslations = async (language) => {
	try {
		const response = await axios.get(
			"/api/method/easy_pos.api.language.get_pos_translations",
			{
				params: { lang: language },
			}
		);
		const translations = response.data.message || {};
		setMessages(language, translations);
		writeCache(language, translations);
	} catch {
		// offline — keep whatever the cache provided
	}
};

// Loads `language`'s translations (easy_pos.api.language.get_pos_translations)
// into translation/index.js. The last fetched set is cached per device so the UI is
// translated instantly on reload and keeps working offline (the service
// worker never caches /api/ responses). Resolves once something usable is in
// place: immediately when cached, else after the fetch (or a timeout).
export const loadTranslations = (language) => {
	if (!language || language === "en") return Promise.resolve();
	const cached = readCache(language);
	if (cached) setMessages(language, cached);
	const fetched = fetchTranslations(language);
	if (cached) return Promise.resolve();
	return Promise.race([
		fetched,
		new Promise((resolve) => setTimeout(resolve, FIRST_LOAD_TIMEOUT_MS)),
	]);
};
