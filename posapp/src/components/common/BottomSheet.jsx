import { useEffect } from "react";

// Mobile-first modal that slides up from the bottom edge. Same open/onClose/
// title/footer contract as Modal, so a feature can swap between the two based
// on useIsMobile(). Closes on backdrop tap and Escape; locks background scroll.
const BottomSheet = ({ open = true, onClose, title, children, footer, fullHeight = false }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="pos-sheet-root">
      <div className="pos-sheet-backdrop" onClick={onClose} />
      <div
        className={`pos-sheet${fullHeight ? " pos-sheet-full" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
      >
        <div className="pos-sheet-handle" aria-hidden="true" />
        {title && <div className="pos-sheet-title">{title}</div>}
        <div className="pos-sheet-body">{children}</div>
        {footer && <div className="pos-sheet-footer">{footer}</div>}
      </div>
    </div>
  );
};

export default BottomSheet;
