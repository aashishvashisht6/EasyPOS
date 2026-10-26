import { useSyncExternalStore } from "react";
import { MOBILE_QUERY } from "../utils/breakpoints";

const subscribe = (callback) => {
	const mql = window.matchMedia(MOBILE_QUERY);
	mql.addEventListener("change", callback);
	return () => mql.removeEventListener("change", callback);
};

const getSnapshot = () => window.matchMedia(MOBILE_QUERY).matches;

// True below the tablet breakpoint (phones). Use for layout swaps CSS alone
// can't express (render a bottom sheet instead of a side panel); prefer plain
// media queries for anything that is only styling.
const useIsMobile = () => useSyncExternalStore(subscribe, getSnapshot, () => false);

export default useIsMobile;
