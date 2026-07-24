import { useId } from "react";
import FieldShell from "./FieldShell";

/** options: Array<string | { label, value }> */
const SelectField = ({
  label,
  value,
  onChange,
  options = [],
  placeholder,
  required,
  disabled,
  error,
  help,
  size = "sm",
  className = "",
  ...rest
}) => {
  const id = useId();
  const invalidClass = error ? "is-invalid" : "";

  const normalized = options.map((opt) =>
    typeof opt === "string" ? { label: opt, value: opt } : opt
  );

  return (
    <FieldShell label={label} htmlFor={id} required={required} error={error} help={help}>
      <select
        id={id}
        className={`form-select form-select-${size} ${invalidClass} ${className}`}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        required={required}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {normalized.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
};

export default SelectField;
