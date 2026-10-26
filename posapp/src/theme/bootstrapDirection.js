import ltrHref from "bootstrap/dist/css/bootstrap.min.css?url";
import rtlHref from "bootstrap/dist/css/bootstrap.rtl.min.css?url";

const LINK_ID = "bootstrap-css";

// Bootstrap ships separate LTR and RTL builds (the RTL one flips every
// physical utility — .me-*, .ps-*, .text-start, dropdown/modal placement), and
// both can't be loaded at once without their margin/padding rules stacking.
// So Bootstrap's CSS is a single <link> whose href swaps with the UI
// language's direction, prepended to <head> so our own theme CSS still wins.
// Resolves once the stylesheet for `dir` has loaded.
export const applyBootstrapDirection = (dir) => {
	const href = dir === "rtl" ? rtlHref : ltrHref;
	let link = document.getElementById(LINK_ID);
	if (link && link.getAttribute("href") === href) return Promise.resolve();
	if (!link) {
		link = document.createElement("link");
		link.id = LINK_ID;
		link.rel = "stylesheet";
		document.head.prepend(link);
	}
	return new Promise((resolve) => {
		link.onload = resolve;
		link.onerror = resolve;
		link.setAttribute("href", href);
	});
};
