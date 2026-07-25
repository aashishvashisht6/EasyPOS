import { useId } from "react";

/**
 * Matches the vertical rhythm of the other common/* fields: a blank spacer
 * the height of a field label sits above the checkbox+label row, so a
 * CheckboxField placed in the same `row g-3` grid as a labeled TextField/
 * SelectField lines up with that field's *input box* — not its label above.
 * Without this, call sites reached for a `d-flex align-items-center` wrapper,
 * which vertically centers the checkbox against the tallest sibling instead;
 * that's what produced the "checkbox floats mid-row while the label sits at
 * the top" misalignment next to any labeled field.
 *
 * The whole row is a <label>, giving a much larger click/tap target than the
 * native checkbox box alone.
 */
const CheckboxField = ({ label, checked, onChange, disabled, help, error, dense = false, className = "", ...rest }) => {
  const id = useId();

  const row = (
    <label htmlFor={id} className={`pos-checkbox-row ${disabled ? "disabled" : ""}`}>
      <input
        id={id}
        type="checkbox"
        className="form-check-input pos-checkbox"
        checked={!!checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
        {...rest}
      />
      {label && <span className="pos-checkbox-label">{label}</span>}
    </label>
  );

  // dense: for use inside a ChildTable/ListTable cell, where the surrounding
  // grid row (not a field label) already sets the vertical rhythm — the
  // label-height spacer would just push the checkbox off-row there.
  if (dense) {
    return (
      <div className={className}>
        {row}
        {error && <div className="pos-field-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className={`pos-field pos-checkbox-field ${className}`}>
      <span className="pos-checkbox-field-spacer" aria-hidden="true" />
      {row}
      {error ? (
        <div className="pos-field-error">{error}</div>
      ) : help ? (
        <div className="pos-field-help">{help}</div>
      ) : null}
    </div>
  );
};

export default CheckboxField;
