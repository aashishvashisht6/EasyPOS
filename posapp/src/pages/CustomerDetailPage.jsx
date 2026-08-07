import { useEffect, useState } from "react";
import { useParams, useOutletContext } from "react-router-dom";
import { fetchCustomer, saveCustomer, fetchAddressDisplay } from "../api/Customer";
import { toastSuccess, toastError } from "../store/toastStore";
import {
  TextField,
  CurrencyField,
  SelectField,
  CheckboxField,
  LinkField,
  ChildTable,
  PageLoader,
  PageHeader,
  ErrorAlert,
  SaveButton,
} from "../components/common";
import AddressContactSection from "../components/Customer/AddressContactSection";

const emptyCustomer = {
  name: "",
  customer_name: "",
  customer_type: "Individual",
  customer_group: "",
  territory: "",
  tax_id: "",
  tax_category: "",
  mobile_no: "",
  email_id: "",
  disabled: 0,
  default_currency: "",
  default_price_list: "",
  payment_terms: "",
  account_manager: "",
  market_segment: "",
  industry: "",
  website: "",
  customer_details: "",
  customer_primary_address: "",
  primary_address: "",
  customer_primary_contact: "",
  credit_limits: [],
  loyalty_program: "",
  loyalty_program_tier: "",
  modified: null,
};

const CustomerDetailPage = () => {
  const { name } = useParams();
  const { setTopbar } = useOutletContext();

  const [form, setForm] = useState(emptyCustomer);
  const [fullDoc, setFullDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchCustomer(name).then((data) => {
      if (data) {
        setFullDoc(data);
        setForm({ ...emptyCustomer, ...data, modified: data.modified });
      }
      setLoading(false);
    });
  }, [name]);

  useEffect(() => {
    setTopbar({ title: form.customer_name || "Customer" });
  }, [form.customer_name, setTopbar]);

  const update = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  // Mirrors Customer.js's `customer_primary_contact` trigger: clearing the
  // primary contact also clears the fetched mobile/email read-only fields.
  const handlePrimaryContactChange = (value) => {
    setForm((f) => ({
      ...f,
      customer_primary_contact: value,
      ...(value ? {} : { mobile_no: "", email_id: "" }),
    }));
  };

  // Mirrors Customer.js's `customer_primary_address` trigger: re-render the
  // primary_address display text whenever the linked address changes.
  const handlePrimaryAddressChange = (value) => {
    setForm((f) => ({ ...f, customer_primary_address: value, primary_address: "" }));
    if (value) {
      fetchAddressDisplay(value).then((display) => {
        setForm((f) => ({ ...f, primary_address: display || "" }));
      });
    }
  };

  const addRow = (field, blank) => {
    setForm((f) => ({ ...f, [field]: [...f[field], blank] }));
  };

  const updateRow = (field, index, patch) => {
    setForm((f) => ({
      ...f,
      [field]: f[field].map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  };

  const removeRow = (field, index) => {
    setForm((f) => ({ ...f, [field]: f[field].filter((_, i) => i !== index) }));
  };

  const handleSubmit = async () => {
    if (!form.customer_name || !form.customer_group || !form.territory) {
      setError("Customer Name, Customer Group and Territory are required");
      return;
    }
    const creditLimitCompanies = form.credit_limits.map((r) => r.company).filter(Boolean);
    if (new Set(creditLimitCompanies).size !== creditLimitCompanies.length) {
      setError("Credit limit is already defined for one of the selected Companies");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        credit_limits: form.credit_limits.filter((r) => r.company),
      };
      // Merge into the full fetched document so fields outside this form
      // (creation, owner, ...) are preserved — frappe.client.save replaces
      // the whole document and set_only_once fields would otherwise fail.
      const saved = await saveCustomer({ ...fullDoc, ...payload, name: form.name, modified: form.modified });
      setFullDoc(saved);
      setForm({ ...emptyCustomer, ...saved, modified: saved.modified });
      toastSuccess("Customer saved successfully");
    } catch (err) {
      const message = err?.response?.data?.exc_type || "Failed to save Customer";
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="px-3 px-md-4 py-3 py-md-4">
      <PageHeader
        title={form.customer_name}
        subtitle={form.name}
        badge={
          <span className={form.disabled ? "pos-badge" : "pos-badge pos-badge-paid"}>
            {form.disabled ? "Inactive" : "Active"}
          </span>
        }
        backTo="/posapp/customers"
        backLabel="Customers"
        actions={<SaveButton saving={saving} onClick={handleSubmit} />}
      />

      <ErrorAlert message={error} />

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Customer Details
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <TextField label="Customer Name" required value={form.customer_name} onChange={update("customer_name")} />
          </div>
          <div className="col-6 col-md-4">
            <SelectField
              label="Customer Type"
              value={form.customer_type}
              onChange={update("customer_type")}
              options={["Company", "Individual", "Partnership"]}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField
              label="Customer Group"
              required
              doctype="Customer Group"
              filters={{ is_group: 0 }}
              value={form.customer_group}
              onChange={update("customer_group")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField
              label="Territory"
              required
              doctype="Territory"
              filters={{ is_group: 0 }}
              value={form.territory}
              onChange={update("territory")}
            />
          </div>
          <div className="col-6 col-md-4">
            <TextField label="Tax ID" value={form.tax_id} onChange={update("tax_id")} />
          </div>
          <div className="col-6 col-md-4">
            <LinkField label="Tax Category" doctype="Tax Category" value={form.tax_category} onChange={update("tax_category")} />
          </div>
          <div className="col-6 col-md-4">
            <TextField label="Mobile No" value={form.mobile_no} disabled readOnly />
          </div>
          <div className="col-6 col-md-4">
            <TextField label="Email" value={form.email_id} disabled readOnly />
          </div>
          <div className="col-6 col-md-4">
            <CheckboxField label="Disabled" checked={form.disabled} onChange={(v) => update("disabled")(v ? 1 : 0)} />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Defaults
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <LinkField
              label="Billing Currency"
              doctype="Currency"
              value={form.default_currency}
              onChange={update("default_currency")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField
              label="Default Price List"
              doctype="Price List"
              filters={{ selling: 1 }}
              value={form.default_price_list}
              onChange={update("default_price_list")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField
              label="Default Payment Terms Template"
              doctype="Payment Terms Template"
              value={form.payment_terms}
              onChange={update("payment_terms")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField label="Account Manager" doctype="User" value={form.account_manager} onChange={update("account_manager")} />
          </div>
          <div className="col-6 col-md-4">
            <LinkField label="Market Segment" doctype="Market Segment" value={form.market_segment} onChange={update("market_segment")} />
          </div>
          <div className="col-6 col-md-4">
            <LinkField label="Industry" doctype="Industry Type" value={form.industry} onChange={update("industry")} />
          </div>
          <div className="col-6 col-md-4">
            <TextField label="Website" value={form.website} onChange={update("website")} />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Loyalty Program
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <LinkField
              label="Loyalty Program"
              doctype="Loyalty Program"
              value={form.loyalty_program}
              onChange={update("loyalty_program")}
            />
          </div>
          {form.loyalty_program && (
            <div className="col-6 col-md-4">
              <TextField label="Tier" value={form.loyalty_program_tier} disabled readOnly />
            </div>
          )}
        </div>
      </div>

      <AddressContactSection
        customerName={form.name}
        isNew={!form.name}
        primaryAddress={form.customer_primary_address}
        primaryContact={form.customer_primary_contact}
        onPrimaryAddressChange={handlePrimaryAddressChange}
        onPrimaryContactChange={handlePrimaryContactChange}
      />

      <div className="pos-card mb-3 p-3 p-md-4">
        <ChildTable
          title="Credit Limits"
          onAddRow={() => addRow("credit_limits", { company: "", credit_limit: "", bypass_credit_limit_check: 0 })}
          rows={form.credit_limits}
          emptyMessage="No credit limits configured"
          columns={[
            {
              key: "company",
              label: "Company",
              width: "1.4fr",
              render: (row, idx) => (
                <LinkField
                  placeholder="Select Company"
                  doctype="Company"
                  value={row.company}
                  onChange={(v) => updateRow("credit_limits", idx, { company: v })}
                />
              ),
            },
            {
              key: "credit_limit",
              label: "Credit Limit",
              width: "1fr",
              render: (row, idx) => (
                <CurrencyField
                  currency={form.default_currency}
                  value={row.credit_limit}
                  onChange={(v) => updateRow("credit_limits", idx, { credit_limit: v })}
                />
              ),
            },
            {
              key: "bypass_credit_limit_check",
              label: "Bypass Check",
              width: "0.9fr",
              render: (row, idx) => (
                <CheckboxField
                  dense
                  label="Bypass Check"
                  checked={row.bypass_credit_limit_check}
                  onChange={(v) => updateRow("credit_limits", idx, { bypass_credit_limit_check: v ? 1 : 0 })}
                />
              ),
            },
            {
              key: "actions",
              label: "",
              width: "40px",
              align: "center",
              render: (row, idx) => (
                <button
                  type="button"
                  className="btn btn-link btn-sm text-danger"
                  onClick={() => removeRow("credit_limits", idx)}
                >
                  <i className="bi bi-trash" />
                </button>
              ),
            },
          ]}
        />
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          More Information
        </h6>
        <div className="row g-3">
          <div className="col-12">
            <TextField
              label="Customer Details"
              value={form.customer_details}
              onChange={update("customer_details")}
              multiline
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDetailPage;
