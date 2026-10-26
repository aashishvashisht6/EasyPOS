import Modal from "./Modal";
import { useTranslation } from "../../translation";

const AlertModal = ({ open, onClose, title, message }) => {
  const { __ } = useTranslation();
  if (!open) return null;

  return (
    <Modal
      title={title ?? __("Validation Error")}
      onClose={onClose}
      size="sm"
      footer={
        <button type="button" className="pos-btn pos-btn-primary" onClick={onClose}>
          {__("OK")}
        </button>
      }
    >
      <div className="d-flex align-items-start gap-2">
        <i className="bi bi-exclamation-triangle-fill" style={{ color: "var(--color-danger-text)", fontSize: 18 }} />
        <span style={{ fontSize: 13.5 }}>{message}</span>
      </div>
    </Modal>
  );
};

export default AlertModal;
