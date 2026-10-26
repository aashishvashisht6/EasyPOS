
import { useTranslation } from "../../translation";
// pos-btn that swaps its label for a spinner + "Saving…" while an async save is in flight.
const SaveButton = ({
  saving,
  onClick,
  disabled,
  label,
  savingLabel,
  variant = "primary",
  type = "button",
  className = "",
}) => {
  const { __ } = useTranslation();
  return (
    <button
      type={type}
      className={`pos-btn pos-btn-${variant} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled || saving}
    >
      {saving ? (
        <>
          <span className="spinner-border spinner-border-sm me-2" role="status" />
          {savingLabel ?? __("Saving…")}
        </>
      ) : (
        label ?? __("Save")
      )}
    </button>
  );
};

export default SaveButton;
