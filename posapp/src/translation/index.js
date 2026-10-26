import { useMemo, useSyncExternalStore } from "react";

// Languages the POS UI offers, the same set Frappe CRM ships. `code` matches Frappe's own Language doctype
// names (User.language), so a cashier's configured Frappe language maps
// straight onto one of these. `dir: "rtl"` flips the whole layout
// (store/languageStore.js sets <html dir>, theme/bootstrapDirection.js swaps
// in Bootstrap's RTL build; our own CSS uses logical properties).
export const LANGUAGES = [
	{ code: "en", label: "English", dir: "ltr" },
	{ code: "ar", label: "العربية", dir: "rtl" },
	{ code: "bg", label: "Български", dir: "ltr" },
	{ code: "bs", label: "Bosanski", dir: "ltr" },
	{ code: "cs", label: "Čeština", dir: "ltr" },
	{ code: "da", label: "Dansk", dir: "ltr" },
	{ code: "de", label: "Deutsch", dir: "ltr" },
	{ code: "es", label: "Español", dir: "ltr" },
	{ code: "fa", label: "فارسی", dir: "rtl" },
	{ code: "fr", label: "Français", dir: "ltr" },
	{ code: "hi", label: "हिन्दी", dir: "ltr" },
	{ code: "hr", label: "Hrvatski", dir: "ltr" },
	{ code: "hu", label: "Magyar", dir: "ltr" },
	{ code: "id", label: "Bahasa Indonesia", dir: "ltr" },
	{ code: "it", label: "Italiano", dir: "ltr" },
	{ code: "km", label: "ខ្មែរ", dir: "ltr" },
	{ code: "ko", label: "한국어", dir: "ltr" },
	{ code: "mn", label: "Монгол", dir: "ltr" },
	{ code: "my", label: "မြန်မာ", dir: "ltr" },
	{ code: "nb", label: "Norsk bokmål", dir: "ltr" },
	{ code: "nl", label: "Nederlands", dir: "ltr" },
	{ code: "pl", label: "Polski", dir: "ltr" },
	{ code: "pt", label: "Português", dir: "ltr" },
	{ code: "pt-BR", label: "Português (Brasil)", dir: "ltr" },
	{ code: "ro", label: "Română", dir: "ltr" },
	{ code: "ru", label: "Русский", dir: "ltr" },
	{ code: "sl", label: "Slovenščina", dir: "ltr" },
	{ code: "sr", label: "Српски", dir: "ltr" },
	{ code: "sv", label: "Svenska", dir: "ltr" },
	{ code: "ta", label: "தமிழ்", dir: "ltr" },
	{ code: "th", label: "ไทย", dir: "ltr" },
	{ code: "tr", label: "Türkçe", dir: "ltr" },
	{ code: "uk", label: "Українська", dir: "ltr" },
	{ code: "uz", label: "Oʻzbek", dir: "ltr" },
	{ code: "vi", label: "Tiếng Việt", dir: "ltr" },
	{ code: "zh", label: "简体中文", dir: "ltr" },
	{ code: "zh-TW", label: "繁體中文", dir: "ltr" },
];

export const languageDir = (code) => LANGUAGES.find((l) => l.code === code)?.dir || "ltr";

// Translations come from Frappe's own translation system, not a bundled
// catalog: easy_pos.api.language.get_pos_translations returns the slice of
// frappe.translate.get_all_translations(lang) this app uses — every installed
// app's .po/.mo files (easy_pos/locale/*.po for POS-specific strings) plus
// desk-managed Translation records. Loaded by translation/loader.js.
let language = "en";
let messages = {};
let version = 0;
const listeners = new Set();

const notify = () => {
	version += 1;
	listeners.forEach((listener) => listener());
};

export const getLanguage = () => language;

export const setLanguage = (code) => {
	if (code === language) return;
	language = code;
	messages = {};
	notify();
};

export const setMessages = (code, dict) => {
	if (code !== language) return;
	messages = dict || {};
	notify();
};

// "{0}" / "{name}" placeholders, same syntax as Frappe's own __().
const format = (text, args) =>
	text.replace(/\{(\w*)\}/g, (match, key) => {
		const value = args[key];
		return value !== undefined && value !== null ? value : match;
	});

// Frappe's `__(text, replace, context)`: the English source string is the
// key, so a missing translation falls back to readable English. Keep the
// first argument a string literal — `bench generate-pot-file --app easy_pos`
// extracts it into easy_pos/locale/main.pot (see easy_pos/translation_extract.py).
export const __ = (text, replace, context) => {
	if (!text || typeof text !== "string") return text;
	const translated = (context && messages[`${text}:${context}`]) || messages[text] || text;
	return replace && typeof replace === "object" ? format(translated, replace) : translated;
};

// Marks a string for extraction without translating it — for module-level
// constants (nav items, table columns, status options) evaluated once at
// import, before/regardless of the active language. Whatever renders them
// translates at render time with __(key): ListTable/ChildTable column labels,
// FilterChips labels and Sidebar items already do.
export const _t = (key) => key;

// __() for a prop that may be a _t key or already-rendered content — only
// plain strings are looked up; elements/numbers/null pass through unchanged.
export const tLabel = (translate, label) =>
	typeof label === "string" && label ? translate(label) : label;

// A record value as stored in ERPNext (item name, mode of payment, item
// group, attribute value...) in the current language, when a translation
// exists for it — otherwise the value itself. Same lookup as __(), but a
// separate name so it's clear these are data, not extractable UI strings.
export const tData = (value) =>
	typeof value === "string" && value ? messages[value] || value : value;

const subscribe = (listener) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

// Re-renders the calling component when the language or its translations
// change. `__` gets a new identity each time, so it's safe in hook deps.
export const useTranslation = () => {
	const current = useSyncExternalStore(subscribe, () => version);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	return useMemo(() => ({ __: (...args) => __(...args), language }), [current]);
};
