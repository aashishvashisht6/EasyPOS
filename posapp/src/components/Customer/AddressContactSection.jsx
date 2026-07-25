import { useEffect, useState } from "react";
import {
  fetchCustomerAddresses,
  fetchCustomerContacts,
  fetchAddress,
  fetchContact,
  deleteAddress,
  deleteContact,
} from "../../api/Customer";
import { LinkField, ConfirmModal } from "../common";
import AddressModal from "./AddressModal";
import ContactModal from "./ContactModal";

const contactName = (c) => [c.first_name, c.last_name].filter(Boolean).join(" ") || c.name;

const linkedToCustomerFilters = (customerName) => [
  ["Dynamic Link", "link_doctype", "=", "Customer"],
  ["Dynamic Link", "link_name", "=", customerName],
];

// Mirrors ERPNext's "Address & Contact" tab on the Customer form: a list of
// linked Address/Contact records (via the Dynamic Link doctype) plus the
// Customer's own customer_primary_address/customer_primary_contact fields.
const AddressContactSection = ({
  customerName,
  isNew,
  primaryAddress,
  primaryContact,
  onPrimaryAddressChange,
  onPrimaryContactChange,
}) => {
  const [addresses, setAddresses] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);

  const [addressModal, setAddressModal] = useState(null); // null | "new" | address row
  const [contactModal, setContactModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type, name }
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const reload = () => {
    if (!customerName) return;
    setLoading(true);
    Promise.all([fetchCustomerAddresses(customerName), fetchCustomerContacts(customerName)])
      .then(([addrs, cts]) => {
        setAddresses(addrs);
        setContacts(cts);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerName]);

  const openEditAddress = async (row) => {
    const doc = await fetchAddress(row.name);
    setAddressModal(doc);
  };

  const openEditContact = async (row) => {
    const doc = await fetchContact(row.name);
    setContactModal(doc);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      if (deleteTarget.type === "Address") await deleteAddress(deleteTarget.name);
      else await deleteContact(deleteTarget.name);
      setDeleteTarget(null);
      reload();
    } catch (err) {
      setDeleteError(err?.response?.data?.exc_type || `Failed to delete ${deleteTarget.type}`);
    } finally {
      setDeleting(false);
    }
  };

  if (isNew) {
    return (
      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-2" style={{ fontSize: 13, fontWeight: 600 }}>
          Address & Contact
        </h6>
        <p className="text-muted mb-0" style={{ fontSize: 13 }}>
          Save the customer first to add addresses and contacts.
        </p>
      </div>
    );
  }

  return (
    <div className="pos-card mb-3 p-3 p-md-4">
      <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
        Address & Contact
      </h6>

      <div className="row g-3 mb-3">
        <div className="col-6 col-md-4">
          <LinkField
            label="Customer Primary Address"
            doctype="Address"
            filters={linkedToCustomerFilters(customerName)}
            value={primaryAddress}
            onChange={onPrimaryAddressChange}
          />
        </div>
        <div className="col-6 col-md-4">
          <LinkField
            label="Customer Primary Contact"
            doctype="Contact"
            filters={linkedToCustomerFilters(customerName)}
            value={primaryContact}
            onChange={onPrimaryContactChange}
          />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-md-6">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-text-muted)" }}>ADDRESSES</span>
            <button type="button" className="pos-btn pos-btn-secondary btn-sm" onClick={() => setAddressModal("new")}>
              <i className="bi bi-plus-lg me-1" /> Add Address
            </button>
          </div>
          {loading ? (
            <div className="text-muted" style={{ fontSize: 13 }}>
              Loading…
            </div>
          ) : addresses.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 13 }}>
              No addresses added
            </div>
          ) : (
            addresses.map((row) => (
              <div
                key={row.name}
                className="d-flex align-items-start justify-content-between border rounded p-2 mb-2"
                style={{ fontSize: 13 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <strong className="text-break">{row.address_title || row.address_type}</strong>
                    <span className="pos-badge">{row.address_type}</span>
                    {row.is_primary_address ? <span className="pos-badge pos-badge-paid">Primary</span> : null}
                    {row.is_shipping_address ? <span className="pos-badge pos-badge-paid">Shipping</span> : null}
                    {row.disabled ? <span className="pos-badge">Disabled</span> : null}
                  </div>
                  <div className="text-muted text-break">
                    {[row.address_line1, row.address_line2, row.city, row.state, row.country]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
                <div className="d-flex gap-1 flex-shrink-0">
                  <button type="button" className="btn btn-link btn-sm" onClick={() => openEditAddress(row)}>
                    <i className="bi bi-pencil" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-danger"
                    onClick={() => setDeleteTarget({ type: "Address", name: row.name })}
                  >
                    <i className="bi bi-trash" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="col-12 col-md-6">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-text-muted)" }}>CONTACTS</span>
            <button type="button" className="pos-btn pos-btn-secondary btn-sm" onClick={() => setContactModal("new")}>
              <i className="bi bi-plus-lg me-1" /> Add Contact
            </button>
          </div>
          {loading ? (
            <div className="text-muted" style={{ fontSize: 13 }}>
              Loading…
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 13 }}>
              No contacts added
            </div>
          ) : (
            contacts.map((row) => (
              <div
                key={row.name}
                className="d-flex align-items-start justify-content-between border rounded p-2 mb-2"
                style={{ fontSize: 13 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <strong className="text-break">{contactName(row)}</strong>
                    {row.is_primary_contact ? <span className="pos-badge pos-badge-paid">Primary</span> : null}
                  </div>
                  <div className="text-muted text-break">
                    {[row.mobile_no || row.phone, row.email_id].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="d-flex gap-1 flex-shrink-0">
                  <button type="button" className="btn btn-link btn-sm" onClick={() => openEditContact(row)}>
                    <i className="bi bi-pencil" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-danger"
                    onClick={() => setDeleteTarget({ type: "Contact", name: row.name })}
                  >
                    <i className="bi bi-trash" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {addressModal && (
        <AddressModal
          customerName={customerName}
          address={addressModal === "new" ? null : addressModal}
          onClose={() => setAddressModal(null)}
          onSaved={() => {
            setAddressModal(null);
            reload();
          }}
        />
      )}

      {contactModal && (
        <ContactModal
          customerName={customerName}
          contact={contactModal === "new" ? null : contactModal}
          onClose={() => setContactModal(null)}
          onSaved={() => {
            setContactModal(null);
            reload();
          }}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError("");
        }}
        onConfirm={handleDelete}
        title={`Delete ${deleteTarget?.type}?`}
        message={`This will permanently delete this ${deleteTarget?.type?.toLowerCase()}.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        error={deleteError}
      />
    </div>
  );
};

export default AddressContactSection;
