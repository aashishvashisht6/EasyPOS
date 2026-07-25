import { useState } from "react";
import { createContact, saveContact } from "../../api/Customer";
import { Modal, TextField, CheckboxField } from "../common";

const blankForm = {
  first_name: "",
  last_name: "",
  email_id: "",
  phone: "",
  mobile_no: "",
  designation: "",
  department: "",
  company_name: "",
  is_primary_contact: 0,
};

// ERPNext's Contact doctype has no `reqd: 1` fields at all, so this form
// mirrors that — nothing here is mandatory. email_id/phone/mobile_no are
// simple fields in this UI but Contact's own validate() (set_primary_email /
// set_primary) derives them from the email_ids/phone_nos child tables, so we
// build those child rows on submit instead of sending the flat fields as-is.
const ContactModal = ({ customerName, contact, onClose, onSaved }) => {
  const [form, setForm] = useState(contact ? { ...blankForm, ...contact } : blankForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const phone_nos = [];
      if (form.phone) phone_nos.push({ phone: form.phone, is_primary_phone: 1 });
      if (form.mobile_no && form.mobile_no !== form.phone) {
        phone_nos.push({ phone: form.mobile_no, is_primary_mobile_no: 1 });
      } else if (form.mobile_no === form.phone && form.mobile_no) {
        phone_nos[0].is_primary_mobile_no = 1;
      }

      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        designation: form.designation,
        department: form.department,
        company_name: form.company_name,
        is_primary_contact: form.is_primary_contact,
        email_ids: form.email_id ? [{ email_id: form.email_id, is_primary: 1 }] : [],
        phone_nos,
      };

      const saved = contact?.name
        ? await saveContact({ ...payload, name: contact.name })
        : await createContact(customerName, payload);
      onSaved(saved);
    } catch (err) {
      setError(err?.response?.data?.exc_type || "Failed to save Contact");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={contact ? "Edit Contact" : "New Contact"}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="pos-btn pos-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="pos-btn pos-btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </button>
        </>
      }
    >
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="row g-3">
        <div className="col-6">
          <TextField label="First Name" value={form.first_name} onChange={update("first_name")} />
        </div>
        <div className="col-6">
          <TextField label="Last Name" value={form.last_name} onChange={update("last_name")} />
        </div>
        <div className="col-6">
          <TextField label="Email Address" type="email" value={form.email_id} onChange={update("email_id")} />
        </div>
        <div className="col-6">
          <TextField label="Phone" value={form.phone} onChange={update("phone")} />
        </div>
        <div className="col-6">
          <TextField label="Mobile No" value={form.mobile_no} onChange={update("mobile_no")} />
        </div>
        <div className="col-6">
          <TextField label="Designation" value={form.designation} onChange={update("designation")} />
        </div>
        <div className="col-6">
          <TextField label="Department" value={form.department} onChange={update("department")} />
        </div>
        <div className="col-6">
          <TextField label="Company Name" value={form.company_name} onChange={update("company_name")} />
        </div>
        <div className="col-6">
          <CheckboxField
            label="Is Primary Contact"
            checked={form.is_primary_contact}
            onChange={(v) => update("is_primary_contact")(v ? 1 : 0)}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ContactModal;
