import TextField from "./TextField";

/** Thin wrapper over TextField locked to type="date" for use with Frappe Date fields. */
const DateField = (props) => <TextField {...props} type="date" icon={props.icon ?? "bi-calendar3"} />;

export default DateField;
