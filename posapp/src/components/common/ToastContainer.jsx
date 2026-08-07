import useToastStore from "../../store/toastStore";

const ICON_BY_TYPE = {
  success: "bi-check-circle-fill",
  danger: "bi-x-circle-fill",
  warning: "bi-exclamation-triangle-fill",
  info: "bi-info-circle-fill",
};

// Global toast stack — mounted once at the app root (main.jsx), reads
// straight from toastStore so any page/component can call
// toastSuccess/toastError/toastWarning/toastInfo (store/toastStore.js)
// without prop-drilling or wrapping pages in a provider. Stacks bottom-up
// in the top-right corner; each toast auto-dismisses on its own timer
// (set when it was shown) but can also be closed early.
const ToastContainer = () => {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pos-toast-viewport">
      {toasts.map((t) => (
        <div key={t.id} className={`pos-toast pos-toast-${t.type}`} role="status">
          <i className={`bi ${ICON_BY_TYPE[t.type] || ICON_BY_TYPE.info} pos-toast-icon`} />
          <span className="pos-toast-message">{t.message}</span>
          <button type="button" className="pos-toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            <i className="bi bi-x" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
