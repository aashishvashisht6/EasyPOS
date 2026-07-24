const FieldShell = ({ label, htmlFor, required, error, help, className = "", children }) => {
  return (
    <div className={`pos-field ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="pos-field-label">
          {label}
          {required && <span className="pos-field-required">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <div className="pos-field-error">{error}</div>
      ) : help ? (
        <div className="pos-field-help">{help}</div>
      ) : null}
    </div>
  );
};

export default FieldShell;
