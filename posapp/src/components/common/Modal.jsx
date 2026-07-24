const Modal = ({ open = true, onClose, title, subtitle, size, children, footer }) => {
  if (!open) return null;

  return (
    <>
      <div className="modal-backdrop show" style={{ zIndex: 1040 }} onClick={onClose} />
      <div
        className="modal show d-block"
        tabIndex="-1"
        style={{ zIndex: 1050 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`modal-dialog modal-dialog-centered${size ? ` modal-${size}` : ""}`}>
          <div className="modal-content shadow">
            <div className="modal-header border-bottom">
              <div>
                <h5 className="modal-title fw-semibold mb-1">{title}</h5>
                {subtitle && (
                  <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                    {subtitle}
                  </p>
                )}
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body">{children}</div>

            {footer && <div className="modal-footer border-top">{footer}</div>}
          </div>
        </div>
      </div>
    </>
  );
};

export default Modal;
