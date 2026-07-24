import { useEffect, useState } from "react";
import { useParams, Link, useOutletContext } from "react-router-dom";
import { fetchCustomer, saveCustomer } from "../api/Customer";
import {
  TextField,
  NumberField,
  CurrencyField,
  SelectField,
  CheckboxField,
  LinkField,
  ChildTable,
} from "../components/common";

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
  sales_team: [],
  accounts: [],
  credit_limits: [],
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
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        sales_team: form.sales_team.filter((r) => r.sales_person),
        accounts: form.accounts.filter((r) => r.company),
        credit_limits: form.credit_limits.filter((r) => r.company),
      };
      // Merge into the full fetched document so fields outside this form
      // (creation, owner, ...) are preserved — frappe.client.save replaces
      // the whole document and set_only_once fields would otherwise fail.
      const saved = await saveCustomer({ ...fullDoc, ...payload, name: form.name, modified: form.modified });
      setFullDoc(saved);
      setForm({ ...emptyCustomer, ...saved, modified: saved.modified });
    } catch (err) {
      setError(err?.response?.data?.exc_type || "Failed to save Customer");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <span className="spinner-border" role="status" />
      </div>
    );
  }

  return (
    <div className="px-3 px-md-4 py-3 py-md-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div style={{ minWidth: 0 }}>
          <Link
            to="/posapp/customers"
            className="d-inline-flex align-items-center gap-1 mb-2 text-decoration-none"
            style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
          >
            <i className="bi bi-arrow-left" /> Customers
          </Link>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <h5 className="mb-0 text-break">{form.customer_name}</h5>
            <span className={form.disabled ? "pos-badge" : "pos-badge pos-badge-paid"}>
              {form.disabled ? "Inactive" : "Active"}
            </span>
          </div>
          <p className="text-muted mb-0 text-break" style={{ fontSize: 13 }}>
            {form.name}
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2 flex-shrink-0">
          <button type="button" className="pos-btn pos-btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

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
              value={form.customer_group}
              onChange={update("customer_group")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField label="Territory" required doctype="Territory" value={form.territory} onChange={update("territory")} />
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
          <div className="col-6 col-md-4 d-flex align-items-center" style={{ paddingTop: 8 }}>
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
        <ChildTable
          title="Sales Team"
          onAddRow={() => addRow("sales_team", { sales_person: "", allocated_percentage: "", commission_rate: "" })}
          rows={form.sales_team}
          emptyMessage="No sales team members"
          columns={[
            {
              key: "sales_person",
              label: "Sales Person",
              width: "1.6fr",
              render: (row, idx) => (
                <LinkField
                  placeholder="Select Sales Person"
                  doctype="Sales Person"
                  value={row.sales_person}
                  onChange={(v) => updateRow("sales_team", idx, { sales_person: v })}
                />
              ),
            },
            {
              key: "allocated_percentage",
              label: "Contribution %",
              width: "1fr",
              render: (row, idx) => (
                <NumberField
                  value={row.allocated_percentage}
                  onChange={(v) => updateRow("sales_team", idx, { allocated_percentage: v })}
                  min={0}
                  max={100}
                />
              ),
            },
            {
              key: "commission_rate",
              label: "Commission Rate",
              width: "1fr",
              render: (row, idx) => (
                <NumberField
                  value={row.commission_rate}
                  onChange={(v) => updateRow("sales_team", idx, { commission_rate: v })}
                  min={0}
                  max={100}
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
                  onClick={() => removeRow("sales_team", idx)}
                >
                  <i className="bi bi-trash" />
                </button>
              ),
            },
          ]}
        />
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <ChildTable
          title="Accounts"
          description="Default receivable account per company."
          onAddRow={() => addRow("accounts", { company: "", account: "" })}
          rows={form.accounts}
          emptyMessage="No accounts configured"
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
                  onChange={(v) => updateRow("accounts", idx, { company: v })}
                />
              ),
            },
            {
              key: "account",
              label: "Account",
              width: "1.4fr",
              render: (row, idx) => (
                <LinkField
                  placeholder="Select Account"
                  doctype="Account"
                  filters={row.company ? { company: row.company } : undefined}
                  value={row.account}
                  onChange={(v) => updateRow("accounts", idx, { account: v })}
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
                  onClick={() => removeRow("accounts", idx)}
                >
                  <i className="bi bi-trash" />
                </button>
              ),
            },
          ]}
        />
      </div>

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
