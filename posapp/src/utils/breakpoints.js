// Single source of truth for layout breakpoints. CSS media queries can't read
// custom properties, so the same numbers are repeated (as comments) in
// theme/tokens.css, theme/components.css and components/Cart/style.css — keep
// them in sync.
export const BREAKPOINT_TABLET = 640;
export const BREAKPOINT_DESKTOP = 1024;

// A phone held sideways is wider than the tablet breakpoint but only ~350-430px
// tall: the two-pane tablet layout leaves the cart a sliver there, so short
// landscape viewports get the phone layout too (a sheet cart, bottom nav).
export const MAX_PHONE_LANDSCAPE_HEIGHT = 500;

export const MOBILE_QUERY = `(max-width: ${
	BREAKPOINT_TABLET - 0.02
}px), (max-height: ${MAX_PHONE_LANDSCAPE_HEIGHT}px) and (orientation: landscape)`;
