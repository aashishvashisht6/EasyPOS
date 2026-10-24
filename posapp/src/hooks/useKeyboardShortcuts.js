import { useEffect, useRef } from "react";
import { matchShortcut } from "../utils/keyboardShortcuts";

const isEditableTarget = (target) =>
	!!target &&
	(target.tagName === "INPUT" ||
		target.tagName === "TEXTAREA" ||
		target.tagName === "SELECT" ||
		target.isContentEditable);

// Any open dialog (common/Modal renders `.modal.show`) owns the keyboard —
// shortcuts acting on the terminal behind it would be surprising, e.g. F2
// opening a second payment modal over an open one.
const isModalOpen = () => !!document.querySelector(".modal.show");

// Global keyboard shortcuts for the POS Terminal — same document-level
// keydown + cleanup shape as useBarcodeScanner, and the same "leave focused
// text fields alone" guard (except shortcuts flagged allowInFields in
// utils/keyboardShortcuts.js). `handlers` maps a SHORTCUTS id to a function;
// a component only passes the ids it owns, so several components can each
// mount this hook for their own shortcuts. A handler returning `false`
// means "didn't apply" (e.g. Pay with an empty cart), so the browser's
// default for that key is left alone.
const useKeyboardShortcuts = ({ handlers, enabled = true }) => {
	const handlersRef = useRef(handlers);

	useEffect(() => {
		handlersRef.current = handlers;
	}, [handlers]);

	useEffect(() => {
		if (!enabled) return undefined;

		const handleKeyDown = (e) => {
			if (e.defaultPrevented || e.repeat || isModalOpen()) return;
			const shortcut = matchShortcut(e);
			if (!shortcut) return;
			const handler = handlersRef.current?.[shortcut.id];
			if (!handler) return;
			if (isEditableTarget(e.target) && !shortcut.allowInFields) return;
			if (handler(e) === false) return;
			e.preventDefault();
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [enabled]);
};

export default useKeyboardShortcuts;
