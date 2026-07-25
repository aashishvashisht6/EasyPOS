import { useEffect, useRef } from "react";

const DEFAULT_MIN_LENGTH = 3;
const DEFAULT_MAX_KEY_INTERVAL_MS = 50; // scanners fire chars far faster than any human typist
const BUFFER_RESET_MS = 500; // clears a stale partial buffer if a scan is interrupted

const isEditableTarget = (target) =>
  !!target &&
  (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);

// Detects hardware barcode-scanner input (keyboard-wedge devices) anywhere on
// the page — scanners fire characters far faster than a human can type, then
// terminate with Enter. Only listens while focus is NOT on an editable field:
// scanning into an already-focused text input (e.g. the topbar search box)
// already works via the browser's native input handling, so intercepting
// there too would double-process the same scan. This lets a cashier scan
// without first clicking into the search box. Reusable across any page that
// needs to react to a hardware scan (POS Terminal today, future stock-take /
// receiving screens later) — just supply a different `onScan`.
const useBarcodeScanner = ({
  onScan,
  enabled = true,
  minLength = DEFAULT_MIN_LENGTH,
  maxKeyIntervalMs = DEFAULT_MAX_KEY_INTERVAL_MS,
} = {}) => {
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    let buffer = [];
    let lastKeyTime = 0;
    let resetHandle = null;

    const clearBuffer = () => {
      buffer = [];
      if (resetHandle) {
        clearTimeout(resetHandle);
        resetHandle = null;
      }
    };

    const scheduleReset = () => {
      if (resetHandle) clearTimeout(resetHandle);
      resetHandle = setTimeout(clearBuffer, BUFFER_RESET_MS);
    };

    const handleKeyDown = (e) => {
      if (isEditableTarget(e.target)) {
        clearBuffer();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Enter") {
        if (buffer.length >= minLength) {
          const code = buffer.join("");
          clearBuffer();
          onScanRef.current?.(code);
        } else {
          clearBuffer();
        }
        return;
      }

      if (e.key.length !== 1) return; // ignore Shift/Tab/Backspace/Arrow keys/etc.

      const now = performance.now();
      const interval = now - lastKeyTime;
      lastKeyTime = now;

      buffer = buffer.length > 0 && interval > maxKeyIntervalMs ? [e.key] : [...buffer, e.key];
      scheduleReset();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearBuffer();
    };
  }, [enabled, minLength, maxKeyIntervalMs]);
};

export default useBarcodeScanner;
