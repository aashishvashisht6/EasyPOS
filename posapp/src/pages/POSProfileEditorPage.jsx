import { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useOutletContext } from "react-router-dom";
import { fetchCompanies } from "../api/Company";
import {
  fetchProfile,
  fetchWarehouses,
  fetchPriceLists,
  fetchModesOfPayment,
  createProfile,
  saveProfile,
} from "../api/POSProfile";
import { SelectField, CheckboxField } from "../components/common";

const emptyProfile = {
  name: "",
  company: "",
  warehouse: "",
  selling_price_list: "",
  payments: [],
  modified: null,
};

const POSProfileEditorPage = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const { setTopbar } = useOutletContext();
  const isEdit = Boolean(name);

  const [form, setForm] = useState(emptyProfile);
  const [fullDoc, setFullDoc] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [modesOfPayment, setModesOfPayment] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCompanies().then((data) => setCompanies(data ?? []));
    fetchWarehouses().then((data) => setWarehouses(data ?? []));
    fetchPriceLists().then((data) => setPriceLists(data ?? []));
    fetchModesOfPayment().then((data) => setModesOfPayment(data ?? []));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    fetchProfile(name).then((data) => {
      if (data) {
        setFullDoc(data);
        setForm({
          name: data.name,
          company: data.company ?? "",
          warehouse: data.warehouse ?? "",
          selling_price_list: data.selling_price_list ?? "",
          payments: data.payments ?? [],
          modified: data.modified,
        });
      }
      setLoading(false);
    });
  }, [isEdit, name]);

  useEffect(() => {
    setTopbar({ title: isEdit ? "Edit POS Profile" : "New POS Profile" });
  }, [isEdit, setTopbar]);

  const addPaymentRow = () => {
    setForm({
      ...form,
      payments: [
        ...form.payments,
        { mode_of_payment: "", default: 0, ep_automatically_calculated: 1 },
      ],
    });
  };

  const updatePaymentRow = (index, mode_of_payment) => {
    setForm({
      ...form,
      payments: form.payments.map((row, i) =>
        i === index ? { ...row, mode_of_payment } : row,
      ),
    });
  };

  const updatePaymentRowField = (index, field, value) => {
    setForm({
      ...form,
      payments: form.payments.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    });
  };

  const removePaymentRow = (index) => {
    setForm({ ...form, payments: form.payments.filter((_, i) => i !== index) });
  };

  const handleSubmit = async () => {
    if (!form.company || !form.warehouse) {
      setError("Company and Warehouse are required");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const payload = {
        company: form.company,
        warehouse: form.warehouse,
        selling_price_list: form.selling_price_list,
        payments: form.payments.filter((row) => row.mode_of_payment),
      };
      // Merge into the full fetched document so fields outside this focused
      // subset editor (currency, write-off accounts, item groups, etc.) are
      // preserved — frappe.client.save replaces the whole document.
      const saved = isEdit
        ? await saveProfile({ ...fullDoc, ...payload, name: form.name, modified: form.modified })
        : await createProfile(payload);

      navigate(`/posapp/pos-profile/${encodeURIComponent(saved.name)}`, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.exc_type || "Failed to save POS Profile");
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
    <div className="px-4 py-4">
      <div className="pos-card" style={{ maxWidth: 720, padding: 24 }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">{isEdit ? `Edit ${form.name}` : "New POS Profile"}</h5>
          {isEdit && (
            <a
              href={`/app/pos-profile/${encodeURIComponent(form.name)}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12 }}
            >
              Edit full profile in Desk
            </a>
          )}
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="row g-3">
          <div className="col-md-6">
            <SelectField
              label="Company"
              required
              placeholder="Select Company"
              value={form.company}
              onChange={(value) => setForm({ ...form, company: value })}
              options={companies.map((c) => ({ label: c.company_name, value: c.name }))}
            />
          </div>

          <div className="col-md-6">
            <SelectField
              label="Warehouse"
              required
              placeholder="Select Warehouse"
              value={form.warehouse}
              onChange={(value) => setForm({ ...form, warehouse: value })}
              options={warehouses.map((w) => ({ label: w.name, value: w.name }))}
            />
          </div>

          <div className="col-md-6">
            <SelectField
              label="Selling Price List"
              placeholder="Select Price List"
              value={form.selling_price_list}
              onChange={(value) => setForm({ ...form, selling_price_list: value })}
              options={priceLists.map((p) => ({ label: p.name, value: p.name }))}
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <label className="pos-field-label mb-0">Modes of Payment</label>
            <button type="button" className="pos-btn pos-btn-secondary" style={{ height: 30, fontSize: 12, padding: "0 12px" }} onClick={addPaymentRow}>
              + Add row
            </button>
          </div>
          <div className="pos-card" style={{ overflow: "hidden" }}>
            {form.payments.length === 0 ? (
              <div className="text-center text-muted py-3" style={{ fontSize: 13 }}>
                No payment modes added
              </div>
            ) : (
              form.payments.map((row, idx) => (
                <div
                  key={idx}
                  className="d-flex align-items-start gap-2 px-3 py-2"
                  style={{
                    borderBottom: idx === form.payments.length - 1 ? "none" : "1px solid var(--color-border-faint)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <SelectField
                      placeholder="Select Mode"
                      value={row.mode_of_payment}
                      onChange={(value) => updatePaymentRow(idx, value)}
                      options={modesOfPayment.map((m) => ({ label: m.name, value: m.name }))}
                    />
                  </div>
                  <div style={{ flex: 1, paddingTop: 8 }}>
                    <CheckboxField
                      label="Automatically Calculated"
                      checked={row.ep_automatically_calculated ?? 1}
                      onChange={(checked) =>
                        updatePaymentRowField(idx, "ep_automatically_calculated", checked ? 1 : 0)
                      }
                    />
                    <div className="pos-field-description" style={{ fontSize: 11, color: "var(--color-text-faint)", marginTop: 2 }}>
                      When checked, the closing amount for this payment method is calculated
                      automatically from sales. Uncheck to have the cashier manually count and
                      enter the amount at POS closing.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-danger"
                    style={{ marginBottom: 14 }}
                    onClick={() => removePaymentRow(idx)}
                  >
                    &times;
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="d-flex gap-2 mt-4">
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
          <Link to="/posapp/pos-profile" className="pos-btn pos-btn-secondary">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
};

export default POSProfileEditorPage;
