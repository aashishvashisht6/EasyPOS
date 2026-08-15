import { create } from "zustand";

// Global toast queue — a page/component calls one of the exported helpers
// (toastSuccess/toastError/toastWarning/toastInfo) from anywhere, no props
// or context wiring needed. `components/common/ToastContainer.jsx` is
// mounted once at the app root (see main.jsx, next to PwaUpdateBanner) and
// renders whatever's in `toasts`, so it works the same on every page
// (including ones outside AppLayout, e.g. CustomerDisplayPage).
let idCounter = 0;

const useToastStore = create((set, get) => ({
	toasts: [],

	show: (message, { type = "info", duration = 4000 } = {}) => {
		const id = ++idCounter;
		set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
		if (duration > 0) {
			setTimeout(() => get().dismiss(id), duration);
		}
		return id;
	},

	dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// duration is in ms; pass { duration: 0 } to keep a toast up until the user
// dismisses it (e.g. for a longer error message worth reading in full).
export const toastSuccess = (message, opts) =>
	useToastStore.getState().show(message, { ...opts, type: "success" });
export const toastError = (message, opts) =>
	useToastStore.getState().show(message, { ...opts, type: "danger" });
export const toastWarning = (message, opts) =>
	useToastStore.getState().show(message, { ...opts, type: "warning" });
export const toastInfo = (message, opts) =>
	useToastStore.getState().show(message, { ...opts, type: "info" });

export default useToastStore;
