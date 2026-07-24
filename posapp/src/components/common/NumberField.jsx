import { useId } from "react";
import FieldShell from "./FieldShell";

const NumberField = ({
  label,
  value,
  onChange,
  placeholder,
  min,
  max,
  step = 1,
  required,
  disabled,
  readOnly,
  error,
  help,
  size = "sm",
  prefix,
  suffix,
  className = "",
  ...rest
}) => {
  const id = useId();
  const invalidClass = error ? "is-invalid" : "";
  const hasGroup = prefix || suffix;

  const input = (
    <input
      id={id}
      type="number"
      className={`form-control ${hasGroup ? "" : `form-control-${size}`} ${invalidClass} ${className}`}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        onChange?.(raw === "" ? "" : Number(raw));
      }}
      min={min}
      max={max}
      step={step}
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
          {prefix && <span className="input-group-text">{prefix}</span>}
          {input}
          {suffix && <span className="input-group-text">{suffix}</span>}
        </div>
      ) : (
        input
      )}
    </FieldShell>
  );
};

export default NumberField;
