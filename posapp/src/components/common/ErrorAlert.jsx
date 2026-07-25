// Inline error banner shown below a page/section header after a failed save or fetch.
const ErrorAlert = ({ message, className = "" }) => {
  if (!message) return null;
  return <div className={`alert alert-danger py-2 ${className}`.trim()}>{message}</div>;
};

export default ErrorAlert;
