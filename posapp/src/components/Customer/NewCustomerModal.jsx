import { useEffect, useState } from "react";
import { createCustomer, fetchCustomerGroups, fetchTerritories } from "../../api/Customer";
import { Modal, TextField, SelectField, ErrorAlert } from "../common";

const emptyForm = {
  customer_name: "",
  customer_type: "Individual",
  customer_group: "",
  territory: "",
  mobile_no: "",
  email_id: "",
};

const NewCustomerModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState(emptyForm);
  const [customerGroups, setCustomerGroups] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCustomerGroups().then((data) => setCustomerGroups(data ?? []));
    fetchTerritories().then((data) => setTerritories(data ?? []));
  }, []);

  const handleSubmit = () => {
    if (!form.customer_name.trim()) {
      setError("Customer name is required");
      return;
    }
    setError("");
    setSubmitting(true);
    createCustomer(form)
      .then((data) => {
        setSubmitting(false);
        if (data?.name) {
          onCreated(data);
        } else {
          setError("Failed to create customer");
        }
      })
      .catch((err) => {
        setSubmitting(false);
        setError(err?.response?.data?.exc_type || "Failed to create customer");
      });
  };

  return (
    <Modal
      title="New Customer"
      subtitle="Add a new customer to bill this sale against."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="pos-btn pos-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="pos-btn pos-btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" />
                Creating…
              </>
            ) : (
              "Create Customer"
            )}
          </button>
        </>
      }
    >
      <ErrorAlert message={error} />

      <TextField
        label="Customer Name"
        required
        placeholder="e.g. Aarav Sharma"
        value={form.customer_name}
        onChange={(value) => setForm((prev) => ({ ...prev, customer_name: value }))}
      />

      <SelectField
        label="Customer Type"
        required
        value={form.customer_type}
        onChange={(value) => setForm((prev) => ({ ...prev, customer_type: value }))}
        options={["Individual", "Company", "Partnership"]}
      />

      <SelectField
        label="Customer Group"
        placeholder="Select customer group"
        value={form.customer_group}
        onChange={(value) => setForm((prev) => ({ ...prev, customer_group: value }))}
        options={customerGroups.map((g) => ({ label: g.name, value: g.name }))}
      />

      <SelectField
        label="Territory"
        placeholder="Select territory"
        value={form.territory}
        onChange={(value) => setForm((prev) => ({ ...prev, territory: value }))}
        options={territories.map((t) => ({ label: t.name, value: t.name }))}
      />

      <TextField
        label="Mobile No"
        placeholder="e.g. 9876543210"
        value={form.mobile_no}
        onChange={(value) => setForm((prev) => ({ ...prev, mobile_no: value }))}
      />

      <TextField
        label="Email"
        type="email"
        placeholder="e.g. customer@example.com"
        value={form.email_id}
        onChange={(value) => setForm((prev) => ({ ...prev, email_id: value }))}
      />
    </Modal>
  );
};

export default NewCustomerModal;
