import Modal from "./Modal";

const AlertModal = ({ open, onClose, title = "Validation Error", message }) => {
  if (!open) return null;

  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <button type="button" className="pos-btn pos-btn-primary" onClick={onClose}>
          OK
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
