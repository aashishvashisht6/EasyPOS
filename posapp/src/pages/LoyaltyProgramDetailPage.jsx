import { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useOutletContext } from "react-router-dom";
import { fetchLoyaltyProgram, createLoyaltyProgram, saveLoyaltyProgram } from "../api/LoyaltyProgram";
import {
  TextField,
  NumberField,
  CurrencyField,
  SelectField,
  CheckboxField,
  DateField,
  LinkField,
  ChildTable,
} from "../components/common";

const emptyProgram = {
  name: "",
  loyalty_program_name: "",
  loyalty_program_type: "Single Tier Program",
  from_date: "",
  to_date: "",
  customer_group: "",
  customer_territory: "",
  auto_opt_in: 0,
  collection_rules: [],
  conversion_factor: 1,
  expiry_duration: "",
  expense_account: "",
  cost_center: "",
  company: "",
  project: "",
  modified: null,
};

const LoyaltyProgramDetailPage = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const { setTopbar } = useOutletContext();
  const isEdit = Boolean(name);

  const [form, setForm] = useState(emptyProgram);
  const [fullDoc, setFullDoc] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEdit) {
      setForm(emptyProgram);
      setLoading(false);
      return;
    }
    fetchLoyaltyProgram(name).then((data) => {
      if (data) {
        setFullDoc(data);
        setForm({ ...emptyProgram, ...data, modified: data.modified });
      }
      setLoading(false);
    });
  }, [isEdit, name]);

  useEffect(() => {
    setTopbar({ title: isEdit ? form.loyalty_program_name || "Loyalty Program" : "New Loyalty Program" });
  }, [isEdit, form.loyalty_program_name, setTopbar]);

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
    if (!form.loyalty_program_name || !form.from_date || !form.conversion_factor) {
      setError("Program Name, From Date and Conversion Factor are required");
      return;
    }
    const collection_rules = form.collection_rules.filter((r) => r.tier_name);
    if (collection_rules.length === 0) {
      setError("Add at least one Collection Rule (tier) — mandatory even for a Single Tier Program");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const payload = { ...form, collection_rules };
      // Merge into the full fetched document so fields outside this form are
      // preserved — frappe.client.save replaces the whole document.
      const saved = isEdit
        ? await saveLoyaltyProgram({ ...fullDoc, ...payload, name: form.name, modified: form.modified })
        : await createLoyaltyProgram(payload);

      navigate(`/posapp/loyalty-program/${encodeURIComponent(saved.name)}`, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.exc_type || "Failed to save Loyalty Program");
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
            to="/posapp/loyalty-program"
            className="d-inline-flex align-items-center gap-1 mb-2 text-decoration-none"
            style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
          >
            <i className="bi bi-arrow-left" /> Loyalty Programs
          </Link>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <h5 className="mb-0 text-break">{isEdit ? form.loyalty_program_name : "New Loyalty Program"}</h5>
          </div>
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
          Program Details
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <TextField label="Program Name" required value={form.loyalty_program_name} onChange={update("loyalty_program_name")} />
          </div>
          <div className="col-6 col-md-4">
            <SelectField
              label="Program Type"
              value={form.loyalty_program_type}
              onChange={update("loyalty_program_type")}
              options={["Single Tier Program", "Multiple Tier Program"]}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField label="Company" doctype="Company" value={form.company} onChange={update("company")} />
          </div>
          <div className="col-6 col-md-4">
            <DateField label="From Date" required value={form.from_date} onChange={update("from_date")} />
          </div>
          <div className="col-6 col-md-4">
            <DateField label="To Date" value={form.to_date} onChange={update("to_date")} />
          </div>
          <div className="col-6 col-md-4">
            <CheckboxField
              label="Auto Opt-In"
              checked={form.auto_opt_in}
              onChange={(v) => update("auto_opt_in")(v ? 1 : 0)}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField
              label="Customer Group"
              doctype="Customer Group"
              filters={{ is_group: 0 }}
              value={form.customer_group}
              onChange={update("customer_group")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField
              label="Customer Territory"
              doctype="Territory"
              filters={{ is_group: 0 }}
              value={form.customer_territory}
              onChange={update("customer_territory")}
            />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <ChildTable
          title="Collection Rules (Tiers)"
          description="Spend thresholds and how many currency units earn 1 loyalty point at each tier."
          onAddRow={() => addRow("collection_rules", { tier_name: "", min_spent: 0, collection_factor: 0 })}
          rows={form.collection_rules}
          emptyMessage="No tiers added"
          columns={[
            {
              key: "tier_name",
              label: "Tier Name",
              width: "1.4fr",
              render: (row, idx) => (
                <TextField
                  placeholder="e.g. Silver"
                  value={row.tier_name}
                  onChange={(v) => updateRow("collection_rules", idx, { tier_name: v })}
                />
              ),
            },
            {
              key: "min_spent",
              label: "Minimum Total Spent",
              width: "1.2fr",
              render: (row, idx) => (
                <CurrencyField
                  value={row.min_spent}
                  onChange={(v) => updateRow("collection_rules", idx, { min_spent: v })}
                />
              ),
            },
            {
              key: "collection_factor",
              label: "Collection Factor (=1 point)",
              width: "1.2fr",
              render: (row, idx) => (
                <CurrencyField
                  value={row.collection_factor}
                  onChange={(v) => updateRow("collection_rules", idx, { collection_factor: v })}
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
                  onClick={() => removeRow("collection_rules", idx)}
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
          Redemption
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <NumberField
              label="Conversion Factor (1 point = ? currency)"
              required
              step="0.01"
              value={form.conversion_factor}
              onChange={update("conversion_factor")}
            />
          </div>
          <div className="col-6 col-md-4">
            <NumberField
              label="Expiry Duration (days)"
              help="Leave empty for points to never expire"
              value={form.expiry_duration}
              onChange={update("expiry_duration")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField
              label="Expense Account"
              doctype="Account"
              filters={form.company ? { company: form.company, is_group: 0 } : undefined}
              value={form.expense_account}
              onChange={update("expense_account")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField
              label="Cost Center"
              doctype="Cost Center"
              filters={form.company ? { company: form.company, is_group: 0 } : undefined}
              value={form.cost_center}
              onChange={update("cost_center")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField label="Project" doctype="Project" value={form.project} onChange={update("project")} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyProgramDetailPage;
