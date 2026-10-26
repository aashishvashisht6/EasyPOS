// POS Terminal keyboard shortcuts (UPCOMING_FEATURES.md #15). The single list
// both useKeyboardShortcuts matches against and the "?" reference modal
// (components/Shortcuts/ShortcutsModal.jsx) renders, so the two can't drift.
//
// `keys` entries: "Mod" is Ctrl on Windows/Linux and ⌘ on macOS (either is
// accepted). `allowInFields` lets a shortcut fire while a text field has
// focus — only for keys that have no text-editing meaning of their own
// (F2, Ctrl+Enter), so typing in the search box or an amount field is
// never hijacked (Ctrl+Backspace, for one, is "delete previous word" there).
export const SHORTCUTS = [
	{ id: "focusSearch", keys: ["/", "Mod+K"], label: "Focus item search" },
	{ id: "openPayment", keys: ["F2", "Mod+Enter"], label: "Take payment", allowInFields: true },
	{ id: "voidLastLine", keys: ["Mod+Backspace"], label: "Remove the last cart line" },
	{ id: "focusDiscount", keys: ["Mod+D"], label: "Focus the order discount" },
	{ id: "showHelp", keys: ["?"], label: "Show these shortcuts" },
];

// Data attributes marking a shortcut's focus target, so the handler can find
// it without threading refs through Topbar/AppLayout.
export const SHORTCUT_TARGETS = {
	itemSearch: "item-search",
	orderDiscount: "order-discount",
};

export const focusShortcutTarget = (target) => {
	const el = document.querySelector(`[data-shortcut-target="${target}"]`);
	if (!el || el.disabled) return false;
	el.focus();
	el.select?.();
	return true;
};

export const isMac = () =>
	typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

// How a key combo is shown in the reference modal ("Mod" → Ctrl or ⌘).
export const displayKeys = (combo) =>
	combo.split("+").map((part) => (part === "Mod" ? (isMac() ? "⌘" : "Ctrl") : part));

const matchesCombo = (event, combo) => {
	const parts = combo.split("+");
	const key = parts[parts.length - 1];
	const wantsMod = parts.includes("Mod");
	const hasMod = event.ctrlKey || event.metaKey;
	if (wantsMod !== hasMod || event.altKey) return false;
	// Shift is part of the key itself for "?" (Shift+/), so it's only checked
	// for letters/named keys where it would change the meaning.
	if (key.length === 1 && !/[a-z]/i.test(key)) return event.key === key;
	if (event.shiftKey) return false;
	return event.key.toLowerCase() === key.toLowerCase();
};

// The SHORTCUTS entry this keydown event triggers, if any.
export const matchShortcut = (event) =>
	SHORTCUTS.find((shortcut) => shortcut.keys.some((combo) => matchesCombo(event, combo)));
