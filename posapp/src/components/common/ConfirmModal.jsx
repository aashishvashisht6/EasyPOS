import Modal from "./Modal";
import { useTranslation } from "../../translation";

// Generic Yes/No confirmation modal (destructive or neutral actions) — reuse
// this instead of hand-rolling a Modal + footer buttons for a confirm step.
const ConfirmModal = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  loading = false,
  error,
}) => {
  const { __ } = useTranslation();
  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? __("Are you sure?")}
      size="sm"
      footer={
        <>
          <button type="button" className="pos-btn pos-btn-secondary" onClick={onClose} disabled={loading}>
            {cancelLabel ?? __("No")}
          </button>
          <button
            type="button"
            className={`pos-btn ${danger ? "pos-btn-danger" : "pos-btn-primary"}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <span className="spinner-border spinner-border-sm" role="status" />}
            {confirmLabel ?? __("Yes")}
          </button>
        </>
      }
    >
      <div className="d-flex align-items-start gap-2">
        <i
          className="bi bi-exclamation-triangle-fill"
          style={{ color: danger ? "var(--color-danger-text)" : "var(--color-warning-text-strong)", fontSize: 18 }}
        />
        <span style={{ fontSize: 13.5 }}>{message}</span>
      </div>
      {error && (
        <div className="alert alert-danger py-2 mt-3 mb-0" style={{ fontSize: 12.5 }}>
          {error}
        </div>
      )}
    </Modal>
  );
};

export default ConfirmModal;
