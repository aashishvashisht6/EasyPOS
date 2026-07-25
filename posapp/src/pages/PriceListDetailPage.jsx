import { useEffect, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { fetchPriceList, createPriceList, savePriceList } from "../api/PriceList";
import {
  TextField,
  LinkField,
  CheckboxField,
  ChildTable,
  PageLoader,
  PageHeader,
  ErrorAlert,
  SaveButton,
} from "../components/common";

const emptyPriceList = {
  name: "",
  price_list_name: "",
  currency: "",
  buying: 0,
  selling: 1,
  enabled: 1,
  price_not_uom_dependent: 0,
  countries: [],
  modified: null,
};

const PriceListDetailPage = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const { setTopbar } = useOutletContext();
  const isEdit = Boolean(name);

  const [form, setForm] = useState(emptyPriceList);
  const [fullDoc, setFullDoc] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEdit) {
      setForm(emptyPriceList);
      setLoading(false);
      return;
    }
    fetchPriceList(name).then((data) => {
      if (data) {
        setFullDoc(data);
        setForm({
          name: data.name,
          price_list_name: data.price_list_name ?? "",
          currency: data.currency ?? "",
          buying: data.buying ?? 0,
          selling: data.selling ?? 0,
          enabled: data.enabled ?? 0,
          price_not_uom_dependent: data.price_not_uom_dependent ?? 0,
          countries: data.countries ?? [],
          modified: data.modified,
        });
      }
      setLoading(false);
    });
  }, [isEdit, name]);

  useEffect(() => {
    setTopbar({ title: isEdit ? form.name || "Price List" : "New Price List" });
  }, [isEdit, form.name, setTopbar]);

  const update = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  const addCountryRow = () => {
    // Avoid stacking multiple blank rows — focus/re-add is pointless if one is already pending.
    if (form.countries.some((row) => !row.country)) return;
    setForm((f) => ({ ...f, countries: [...f.countries, { country: "" }] }));
  };

  const updateCountryRow = (index, country) => {
    setForm((f) => ({
      ...f,
      countries: f.countries.map((row, i) => (i === index ? { ...row, country } : row)),
    }));
  };

  const removeCountryRow = (index) => {
    setForm((f) => ({ ...f, countries: f.countries.filter((_, i) => i !== index) }));
  };

  const selectedCountries = form.countries.map((row) => row.country).filter(Boolean);
  const duplicateCountries = selectedCountries.filter((c, i) => selectedCountries.indexOf(c) !== i);

  const handleSubmit = async () => {
    if (!form.price_list_name || !form.currency) {
      setError("Price List Name and Currency are required");
      return;
    }
    // Mirrors price_list.py's validate(): a Price List must be usable for at
    // least one of Buying/Selling.
    if (!form.buying && !form.selling) {
      setError("Price List must be applicable for Buying or Selling");
      return;
    }
    if (duplicateCountries.length > 0) {
      setError(`Country added more than once: ${[...new Set(duplicateCountries)].join(", ")}`);
      return;
    }
    setError("");
    setSaving(true);
    try {
      const payload = {
        price_list_name: form.price_list_name,
        currency: form.currency,
        buying: form.buying ? 1 : 0,
        selling: form.selling ? 1 : 0,
        enabled: form.enabled ? 1 : 0,
        price_not_uom_dependent: form.price_not_uom_dependent ? 1 : 0,
        countries: form.countries.filter((row) => row.country),
      };
      // Merge into the full fetched document so fields outside this editor
      // (creation, owner, ...) are preserved — frappe.client.save replaces
      // the whole document and set_only_once fields would otherwise fail.
      const saved = isEdit
        ? await savePriceList({ ...fullDoc, ...payload, name: form.name, modified: form.modified })
        : await createPriceList(payload);

      // Editing the same doc keeps the same URL, so the fetch-on-mount effect
      // never reruns — refresh fullDoc/modified from the response here,
      // otherwise a second save in the same visit fails with
      // TimestampMismatchError against the now-stale `modified` we hold.
      setFullDoc(saved);
      setForm((f) => ({ ...f, countries: saved.countries ?? [], modified: saved.modified }));

      if (!isEdit) {
        navigate(`/posapp/price-list/${encodeURIComponent(saved.name)}`, { replace: true });
      }
    } catch (err) {
      setError(err?.response?.data?.exc_type || "Failed to save Price List");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="px-3 px-md-4 py-3 py-md-4">
      <PageHeader
        title={isEdit ? form.name : "New Price List"}
        backTo="/posapp/price-list"
        backLabel="Price Lists"
        actions={<SaveButton saving={saving} onClick={handleSubmit} />}
      />

      <ErrorAlert message={error} />

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Price List Details
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <TextField label="Price List Name" required value={form.price_list_name} onChange={update("price_list_name")} />
          </div>
          <div className="col-6 col-md-4">
            <LinkField label="Currency" required doctype="Currency" value={form.currency} onChange={update("currency")} />
          </div>
          <div className="col-12 d-flex flex-wrap gap-4">
            <CheckboxField label="Buying" checked={form.buying} onChange={(v) => update("buying")(v ? 1 : 0)} />
            <CheckboxField label="Selling" checked={form.selling} onChange={(v) => update("selling")(v ? 1 : 0)} />
            <CheckboxField label="Enabled" checked={form.enabled} onChange={(v) => update("enabled")(v ? 1 : 0)} />
            <CheckboxField
              label="Price Not UOM Dependent"
              checked={form.price_not_uom_dependent}
              onChange={(v) => update("price_not_uom_dependent")(v ? 1 : 0)}
            />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <ChildTable
          title="Applicable for Countries"
          description="Leave empty to make this price list applicable for all countries, or restrict it to specific ones."
          onAddRow={addCountryRow}
          rows={form.countries}
          emptyMessage="No countries added — applies to all countries"
          columns={[
            {
              key: "idx",
              label: "#",
              width: "40px",
              render: (row, idx) => <span style={{ color: "var(--color-text-faint)" }}>{idx + 1}</span>,
            },
            {
              key: "country",
              label: "Country",
              render: (row, idx) => {
                const isDuplicate = row.country && duplicateCountries.includes(row.country);
                return (
                  <LinkField
                    placeholder="Select Country"
                    doctype="Country"
                    filters={{ name: ["not in", selectedCountries.filter((c) => c !== row.country)] }}
                    value={row.country}
                    onChange={(v) => updateCountryRow(idx, v)}
                    error={isDuplicate ? "Already added" : undefined}
                  />
                );
              },
            },
            {
              key: "actions",
              label: "",
              width: "40px",
              align: "center",
              render: (row, idx) => (
                <button type="button" className="btn btn-link btn-sm text-danger" onClick={() => removeCountryRow(idx)}>
                  <i className="bi bi-trash" />
                </button>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
};

export default PriceListDetailPage;
