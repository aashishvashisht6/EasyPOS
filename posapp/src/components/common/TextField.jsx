import { useId } from "react";
import FieldShell from "./FieldShell";

const TextField = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  disabled,
  readOnly,
  error,
  help,
  size = "sm",
  icon,
  trailingIcon,
  onTrailingIconClick,
  trailingIconLabel,
  className = "",
  multiline,
  rows = 3,
  ...rest
}) => {
  const id = useId();
  const invalidClass = error ? "is-invalid" : "";
  const hasGroup = icon || trailingIcon;
  const sizeClass = hasGroup ? "" : `form-control-${size}`;

  const control = multiline ? (
    <textarea
      id={id}
      className={`form-control ${sizeClass} ${invalidClass} ${className}`}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      rows={rows}
      {...rest}
    />
  ) : (
    <input
      id={id}
      type={type}
      className={`form-control ${sizeClass} ${invalidClass} ${className}`}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      {...rest}
    />
  );

  return (
    <FieldShell label={label} htmlFor={id} required={required} error={error} help={help}>
      {hasGroup ? (
        <div className={`input-group input-group-${size}`}>
          {icon && (
            <span className="input-group-text bg-white">
              <i className={`bi ${icon}`} />
            </span>
          )}
          {control}
          {trailingIcon && (
            <button
              type="button"
              className="btn btn-outline-secondary"
              tabIndex={-1}
              aria-label={trailingIconLabel}
              onClick={onTrailingIconClick}
            >
              <i className={`bi ${trailingIcon}`} />
            </button>
          )}
        </div>
      ) : (
        control
      )}
    </FieldShell>
  );
};

export default TextField;
