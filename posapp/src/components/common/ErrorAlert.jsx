// Inline error banner shown below a page/section header after a failed save or fetch.
// `variant="warning"` for a non-blocking heads-up instead of a failure.
const ErrorAlert = ({ message, className = "", variant = "danger" }) => {
  if (!message) return null;
  return <div className={`alert alert-${variant} py-2 ${className}`.trim()}>{message}</div>;
};

export default ErrorAlert;
