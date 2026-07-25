import { useState } from "react";
import { createAddress, saveAddress } from "../../api/Customer";
import { Modal, TextField, SelectField, LinkField, CheckboxField } from "../common";

const ADDRESS_TYPES = [
  "Billing",
  "Shipping",
  "Office",
  "Personal",
  "Plant",
  "Postal",
  "Shop",
  "Subsidiary",
  "Warehouse",
  "Current",
  "Permanent",
  "Other",
];

const blankForm = {
  address_title: "",
  address_type: "Billing",
  address_line1: "",
  address_line2: "",
  city: "",
  county: "",
  state: "",
  country: "",
  pincode: "",
  phone: "",
  email_id: "",
  fax: "",
  is_primary_address: 0,
  is_shipping_address: 0,
  disabled: 0,
};

// Mirrors ERPNext's Address doctype: address_type, address_line1, city and
// country are the only fields marked `reqd: 1` there — no others.
const AddressModal = ({ customerName, address, onClose, onSaved }) => {
  const [form, setForm] = useState(address ? { ...blankForm, ...address } : blankForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.address_type || !form.address_line1 || !form.city || !form.country) {
      setError("Address Type, Address Line 1, City/Town and Country are required");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const saved = address?.name
        ? await saveAddress({ ...form, name: address.name })
        : await createAddress(customerName, form);
      onSaved(saved);
    } catch (err) {
      setError(err?.response?.data?.exc_type || "Failed to save Address");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={address ? "Edit Address" : "New Address"}
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
          <TextField label="Address Title" value={form.address_title} onChange={update("address_title")} />
        </div>
        <div className="col-6">
          <SelectField
            label="Address Type"
            required
            value={form.address_type}
            onChange={update("address_type")}
            options={ADDRESS_TYPES}
          />
        </div>
        <div className="col-12">
          <TextField label="Address Line 1" required value={form.address_line1} onChange={update("address_line1")} />
        </div>
        <div className="col-12">
          <TextField label="Address Line 2" value={form.address_line2} onChange={update("address_line2")} />
        </div>
        <div className="col-6">
          <TextField label="City/Town" required value={form.city} onChange={update("city")} />
        </div>
        <div className="col-6">
          <TextField label="County" value={form.county} onChange={update("county")} />
        </div>
        <div className="col-6">
          <TextField label="State/Province" value={form.state} onChange={update("state")} />
        </div>
        <div className="col-6">
          <LinkField label="Country" required doctype="Country" value={form.country} onChange={update("country")} />
        </div>
        <div className="col-6">
          <TextField label="Postal Code" value={form.pincode} onChange={update("pincode")} />
        </div>
        <div className="col-6">
          <TextField label="Phone" value={form.phone} onChange={update("phone")} />
        </div>
        <div className="col-6">
          <TextField label="Email Address" type="email" value={form.email_id} onChange={update("email_id")} />
        </div>
        <div className="col-6">
          <TextField label="Fax" value={form.fax} onChange={update("fax")} />
        </div>
        <div className="col-6">
          <CheckboxField
            label="Preferred Billing Address"
            checked={form.is_primary_address}
            onChange={(v) => update("is_primary_address")(v ? 1 : 0)}
          />
        </div>
        <div className="col-6">
          <CheckboxField
            label="Preferred Shipping Address"
            checked={form.is_shipping_address}
            onChange={(v) => update("is_shipping_address")(v ? 1 : 0)}
          />
        </div>
        <div className="col-6">
          <CheckboxField label="Disabled" checked={form.disabled} onChange={(v) => update("disabled")(v ? 1 : 0)} />
        </div>
      </div>
    </Modal>
  );
};

export default AddressModal;
