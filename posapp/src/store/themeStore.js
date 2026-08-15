import { create } from "zustand";

const STORAGE_KEY = "easy-pos-theme";

const getSystemTheme = () =>
	window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const getInitialTheme = () => {
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === "dark" || stored === "light" ? stored : getSystemTheme();
};

// Applies the theme to both our own CSS tokens (data-theme, see
// theme/tokens.css) and Bootstrap 5.3's built-in dark-mode variables
// (data-bs-theme), so Bootstrap-native chrome (modals, dropdowns) adapts
// without needing its own per-component overrides.
const applyTheme = (theme) => {
	document.documentElement.setAttribute("data-theme", theme);
	document.documentElement.setAttribute("data-bs-theme", theme);
};

const useThemeStore = create((set, get) => ({
	theme: getInitialTheme(),

	setTheme: (theme) => {
		localStorage.setItem(STORAGE_KEY, theme);
		applyTheme(theme);
		set({ theme });
	},

	toggleTheme: () => {
		get().setTheme(get().theme === "dark" ? "light" : "dark");
	},
}));

applyTheme(useThemeStore.getState().theme);

export default useThemeStore;
