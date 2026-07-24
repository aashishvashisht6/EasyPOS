import { useId } from "react";

const CheckboxField = ({ label, checked, onChange, disabled, className = "", ...rest }) => {
  const id = useId();
  return (
    <div className={`form-check ${className}`}>
      <input
        id={id}
        type="checkbox"
        className="form-check-input pos-checkbox"
        checked={!!checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
        {...rest}
      />
      {label && (
        <label htmlFor={id} className="form-check-label pos-field-label mb-0">
          {label}
        </label>
      )}
    </div>
  );
};

export default CheckboxField;
