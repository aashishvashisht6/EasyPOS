import { useId } from "react";
import usePOSSessionStore from "../../store/posSessionStore";
import FieldShell from "./FieldShell";

/**
 * Number field prefixed with the active shift's currency symbol, resolved from
 * the open POS Profile's currency (see posSessionStore.loadProfileDetails).
 * Pass `currency` to override (e.g. a multi-currency price list), otherwise it
 * follows the currently open till.
 */
const CurrencyField = ({
  label,
  value,
  onChange,
  placeholder = "0",
  min,
  step = "any",
  required,
  disabled,
  readOnly,
  error,
  help,
  size = "sm",
  currency,
  className = "",
  ...rest
}) => {
  const id = useId();
  const storeSymbol = usePOSSessionStore((s) => s.currencySymbol);
  const symbol = currency ?? storeSymbol;
  const invalidClass = error ? "is-invalid" : "";

  return (
    <FieldShell label={label} htmlFor={id} required={required} error={error} help={help}>
      <div className={`input-group input-group-${size}`}>
        <span className="input-group-text">{symbol}</span>
        <input
          id={id}
          type="number"
          className={`form-control ${invalidClass} ${className}`}
          placeholder={placeholder}
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            onChange?.(raw === "" ? "" : Number(raw));
          }}
          min={min}
          step={step}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          {...rest}
        />
      </div>
    </FieldShell>
  );
};

export default CurrencyField;
