import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import Modal from "./Modal";

// Camera-based barcode/QR scanner — reuses the device camera to decode a
// code and hand it back to the caller, so any page can populate a field the
// same way a physical hardware scanner would (see hooks/useBarcodeScanner
// for the keyboard-wedge equivalent). Self-contained: owns the camera
// stream/decoder lifecycle, caller only needs `open`/`onClose`/`onDetected`.
const BarcodeScannerModal = ({ open, onClose, onDetected, title = "Scan barcode", subtitle }) => {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    let cancelled = false;

    // Deferred (not a direct synchronous setState in the effect body) so a
    // stale error from a previous attempt clears before this one starts.
    Promise.resolve().then(() => {
      if (!cancelled) setError("");
    });

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err, controls) => {
        controlsRef.current = controls;
        if (cancelled || !result) return;
        controls.stop();
        onDetected?.(result.getText());
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.name === "NotAllowedError"
            ? "Camera access was denied. Allow camera permission and try again."
            : err?.name === "NotFoundError"
              ? "No camera was found on this device."
              : "Unable to start the camera.",
        );
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected]);

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} size="sm">
      {error ? (
        <div className="alert alert-danger py-2 mb-0" style={{ fontSize: 12.5 }}>
          {error}
        </div>
      ) : (
        <div style={{ position: "relative", borderRadius: "var(--radius-md)", overflow: "hidden", background: "#000" }}>
          <video ref={videoRef} style={{ width: "100%", display: "block", maxHeight: 320, objectFit: "cover" }} muted playsInline />
          <div
            style={{
              position: "absolute",
              inset: "20% 12%",
              border: "2px solid var(--color-primary, #fff)",
              borderRadius: "var(--radius-sm)",
              pointerEvents: "none",
            }}
          />
        </div>
      )}
      <p className="text-muted mt-2 mb-0" style={{ fontSize: 12.5 }}>
        Point the camera at a barcode, QR code, or serial/batch label.
      </p>
    </Modal>
  );
};

export default BarcodeScannerModal;
