import { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useOutletContext } from "react-router-dom";
import { fetchPricingRule, createPricingRule, savePricingRule } from "../api/PricingRule";
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

const emptyPricingRule = {
  name: "",
  title: "",
  disable: 0,
  apply_on: "Item Code",
  price_or_product_discount: "Price",
  warehouse: "",
  items: [],
  item_groups: [],
  brands: [],
  mixed_conditions: 0,
  is_cumulative: 0,
  coupon_code_based: 0,
  selling: 0,
  buying: 0,
  applicable_for: "",
  customer: "",
  customer_group: "",
  territory: "",
  sales_partner: "",
  campaign: "",
  supplier: "",
  supplier_group: "",
  min_qty: "",
  max_qty: "",
  min_amt: 0,
  max_amt: 0,
  valid_from: "",
  valid_upto: "",
  company: "",
  currency: "",
  margin_type: "Percentage",
  margin_rate_or_amount: 0,
  rate_or_discount: "Discount Percentage",
  apply_discount_on: "Grand Total",
  rate: 0,
  discount_amount: 0,
  discount_percentage: "",
  for_price_list: "",
  same_item: 0,
  free_item: "",
  free_qty: 0,
  free_item_uom: "",
  free_item_rate: "",
  has_priority: 0,
  priority: "",
  apply_multiple_pricing_rules: 0,
  modified: null,
};

const APPLICABLE_FOR_OPTIONS = [
  "Customer",
  "Customer Group",
  "Territory",
  "Sales Partner",
  "Campaign",
  "Supplier",
  "Supplier Group",
];

const PRIORITY_OPTIONS = Array.from({ length: 20 }, (_, i) => String(i + 1));

const DiscountDetailPage = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const { setTopbar } = useOutletContext();
  const isEdit = Boolean(name);

  const [form, setForm] = useState(emptyPricingRule);
  const [fullDoc, setFullDoc] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEdit) {
      setForm(emptyPricingRule);
      setLoading(false);
      return;
    }
    fetchPricingRule(name).then((data) => {
      if (data) {
        setFullDoc(data);
        setForm({ ...emptyPricingRule, ...data, modified: data.modified });
      }
      setLoading(false);
    });
  }, [isEdit, name]);

  useEffect(() => {
    setTopbar({ title: isEdit ? form.name || form.title || "Discount" : "New Discount" });
  }, [isEdit, form.name, form.title, setTopbar]);

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
    if (!form.title) {
      setError("Title is required");
      return;
    }
    if (!form.selling && !form.buying) {
      setError("At least one of Selling or Buying must be checked");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: form.items.filter((r) => r.item_code),
        item_groups: form.item_groups.filter((r) => r.item_group),
        brands: form.brands.filter((r) => r.brand),
      };
      // Merge into the full fetched document so fields outside this editor
      // (creation, owner, ...) are preserved — frappe.client.save replaces
      // the whole document and set_only_once fields would otherwise fail.
      const saved = isEdit
        ? await savePricingRule({ ...fullDoc, ...payload, name: form.name, modified: form.modified })
        : await createPricingRule(payload);

      setFullDoc(saved);
      setForm((f) => ({
        ...f,
        items: saved.items ?? [],
        item_groups: saved.item_groups ?? [],
        brands: saved.brands ?? [],
        modified: saved.modified,
      }));

      if (!isEdit) {
        navigate(`/posapp/discounts/${encodeURIComponent(saved.name)}`, { replace: true });
      }
    } catch (err) {
      setError(err?.response?.data?.exc_type || "Failed to save Discount");
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

  const isTransaction = form.apply_on === "Transaction";
  const isPriceDiscount = form.price_or_product_discount === "Price";
  const isProductDiscount = form.price_or_product_discount === "Product";

  return (
    <div className="px-3 px-md-4 py-3 py-md-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div style={{ minWidth: 0 }}>
          <Link
            to="/posapp/discounts"
            className="d-inline-flex align-items-center gap-1 mb-2 text-decoration-none"
            style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
          >
            <i className="bi bi-arrow-left" /> Discounts
          </Link>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <h5 className="mb-0 text-break">{isEdit ? form.name : "New Discount"}</h5>
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
          Applicability
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <TextField label="Title" required value={form.title} onChange={update("title")} />
          </div>
          <div className="col-6 col-md-4">
            <SelectField
              label="Apply On"
              value={form.apply_on}
              onChange={update("apply_on")}
              options={["Item Code", "Item Group", "Brand", "Transaction"]}
            />
          </div>
          <div className="col-6 col-md-4">
            <SelectField
              label="Price or Product Discount"
              value={form.price_or_product_discount}
              onChange={update("price_or_product_discount")}
              options={["Price", "Product"]}
            />
          </div>
          {!isTransaction && (
            <div className="col-6 col-md-4">
              <LinkField label="Warehouse" doctype="Warehouse" value={form.warehouse} onChange={update("warehouse")} />
            </div>
          )}
          <div className="col-12 d-flex flex-wrap align-items-center gap-4" style={{ paddingTop: 8 }}>
            {!isTransaction && (
              <>
                <CheckboxField
                  label="Mixed Conditions"
                  checked={form.mixed_conditions}
                  onChange={(v) => update("mixed_conditions")(v ? 1 : 0)}
                />
                <CheckboxField
                  label="Is Cumulative"
                  checked={form.is_cumulative}
                  onChange={(v) => update("is_cumulative")(v ? 1 : 0)}
                />
              </>
            )}
            <CheckboxField
              label="Coupon Code Based"
              checked={form.coupon_code_based}
              onChange={(v) => update("coupon_code_based")(v ? 1 : 0)}
            />
            <CheckboxField label="Disabled" checked={form.disable} onChange={(v) => update("disable")(v ? 1 : 0)} />
          </div>
        </div>
      </div>

      {form.apply_on === "Item Code" && (
        <div className="pos-card mb-3 p-3 p-md-4">
          <ChildTable
            title="Apply Rule On Item Code"
            onAddRow={() => addRow("items", { item_code: "", uom: "" })}
            rows={form.items}
            emptyMessage="No items added"
            columns={[
              {
                key: "item_code",
                label: "Item Code",
                width: "1.6fr",
                render: (row, idx) => (
                  <LinkField
                    placeholder="Select Item"
                    doctype="Item"
                    value={row.item_code}
                    onChange={(v) => updateRow("items", idx, { item_code: v })}
                  />
                ),
              },
              {
                key: "uom",
                label: "UOM",
                width: "1fr",
                render: (row, idx) => (
                  <LinkField
                    placeholder="Select UOM"
                    doctype="UOM"
                    value={row.uom}
                    onChange={(v) => updateRow("items", idx, { uom: v })}
                  />
                ),
              },
              {
                key: "actions",
                label: "",
                width: "40px",
                align: "center",
                render: (row, idx) => (
                  <button type="button" className="btn btn-link btn-sm text-danger" onClick={() => removeRow("items", idx)}>
                    <i className="bi bi-trash" />
                  </button>
                ),
              },
            ]}
          />
        </div>
      )}

      {form.apply_on === "Item Group" && (
        <div className="pos-card mb-3 p-3 p-md-4">
          <ChildTable
            title="Apply Rule On Item Group"
            onAddRow={() => addRow("item_groups", { item_group: "", uom: "" })}
            rows={form.item_groups}
            emptyMessage="No item groups added"
            columns={[
              {
                key: "item_group",
                label: "Item Group",
                width: "1.6fr",
                render: (row, idx) => (
                  <LinkField
                    placeholder="Select Item Group"
                    doctype="Item Group"
                    value={row.item_group}
                    onChange={(v) => updateRow("item_groups", idx, { item_group: v })}
                  />
                ),
              },
              {
                key: "uom",
                label: "UOM",
                width: "1fr",
                render: (row, idx) => (
                  <LinkField
                    placeholder="Select UOM"
                    doctype="UOM"
                    value={row.uom}
                    onChange={(v) => updateRow("item_groups", idx, { uom: v })}
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
                    onClick={() => removeRow("item_groups", idx)}
                  >
                    <i className="bi bi-trash" />
                  </button>
                ),
              },
            ]}
          />
        </div>
      )}

      {form.apply_on === "Brand" && (
        <div className="pos-card mb-3 p-3 p-md-4">
          <ChildTable
            title="Apply Rule On Brand"
            onAddRow={() => addRow("brands", { brand: "", uom: "" })}
            rows={form.brands}
            emptyMessage="No brands added"
            columns={[
              {
                key: "brand",
                label: "Brand",
                width: "1.6fr",
                render: (row, idx) => (
                  <LinkField
                    placeholder="Select Brand"
                    doctype="Brand"
                    value={row.brand}
                    onChange={(v) => updateRow("brands", idx, { brand: v })}
                  />
                ),
              },
              {
                key: "uom",
                label: "UOM",
                width: "1fr",
                render: (row, idx) => (
                  <LinkField
                    placeholder="Select UOM"
                    doctype="UOM"
                    value={row.uom}
                    onChange={(v) => updateRow("brands", idx, { uom: v })}
                  />
                ),
              },
              {
                key: "actions",
                label: "",
                width: "40px",
                align: "center",
                render: (row, idx) => (
                  <button type="button" className="btn btn-link btn-sm text-danger" onClick={() => removeRow("brands", idx)}>
                    <i className="bi bi-trash" />
                  </button>
                ),
              },
            ]}
          />
        </div>
      )}

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Party Information
        </h6>
        <div className="row g-3">
          <div className="col-12 d-flex align-items-center gap-4">
            <CheckboxField label="Selling" checked={form.selling} onChange={(v) => update("selling")(v ? 1 : 0)} />
            <CheckboxField label="Buying" checked={form.buying} onChange={(v) => update("buying")(v ? 1 : 0)} />
          </div>
          {(form.selling || form.buying) && (
            <div className="col-6 col-md-4">
              <SelectField
                label="Applicable For"
                placeholder="All"
                value={form.applicable_for}
                onChange={update("applicable_for")}
                options={APPLICABLE_FOR_OPTIONS}
              />
            </div>
          )}
          {form.applicable_for === "Customer" && (
            <div className="col-6 col-md-4">
              <LinkField label="Customer" doctype="Customer" value={form.customer} onChange={update("customer")} />
            </div>
          )}
          {form.applicable_for === "Customer Group" && (
            <div className="col-6 col-md-4">
              <LinkField
                label="Customer Group"
                doctype="Customer Group"
                value={form.customer_group}
                onChange={update("customer_group")}
              />
            </div>
          )}
          {form.applicable_for === "Territory" && (
            <div className="col-6 col-md-4">
              <LinkField label="Territory" doctype="Territory" value={form.territory} onChange={update("territory")} />
            </div>
          )}
          {form.applicable_for === "Sales Partner" && (
            <div className="col-6 col-md-4">
              <LinkField
                label="Sales Partner"
                doctype="Sales Partner"
                value={form.sales_partner}
                onChange={update("sales_partner")}
              />
            </div>
          )}
          {form.applicable_for === "Campaign" && (
            <div className="col-6 col-md-4">
              <LinkField label="Campaign" doctype="Campaign" value={form.campaign} onChange={update("campaign")} />
            </div>
          )}
          {form.applicable_for === "Supplier" && (
            <div className="col-6 col-md-4">
              <LinkField label="Supplier" doctype="Supplier" value={form.supplier} onChange={update("supplier")} />
            </div>
          )}
          {form.applicable_for === "Supplier Group" && (
            <div className="col-6 col-md-4">
              <LinkField
                label="Supplier Group"
                doctype="Supplier Group"
                value={form.supplier_group}
                onChange={update("supplier_group")}
              />
            </div>
          )}
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Quantity and Amount
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-3">
            <NumberField label="Min Qty (Stock UOM)" value={form.min_qty} onChange={update("min_qty")} />
          </div>
          <div className="col-6 col-md-3">
            <NumberField label="Max Qty (Stock UOM)" value={form.max_qty} onChange={update("max_qty")} />
          </div>
          <div className="col-6 col-md-3">
            <CurrencyField label="Min Amount" currency={form.currency} value={form.min_amt} onChange={update("min_amt")} />
          </div>
          <div className="col-6 col-md-3">
            <CurrencyField label="Max Amount" currency={form.currency} value={form.max_amt} onChange={update("max_amt")} />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Period Settings
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-3">
            <DateField label="Valid From" value={form.valid_from} onChange={update("valid_from")} />
          </div>
          <div className="col-6 col-md-3">
            <DateField label="Valid Upto" value={form.valid_upto} onChange={update("valid_upto")} />
          </div>
          <div className="col-6 col-md-3">
            <LinkField label="Company" doctype="Company" value={form.company} onChange={update("company")} />
          </div>
          <div className="col-6 col-md-3">
            <LinkField label="Currency" doctype="Currency" value={form.currency} onChange={update("currency")} />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Margin
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <SelectField
              label="Margin Type"
              value={form.margin_type}
              onChange={update("margin_type")}
              options={["", "Percentage", "Amount"]}
            />
          </div>
          {form.margin_type && (
            <div className="col-6 col-md-4">
              <NumberField
                label="Margin Rate or Amount"
                value={form.margin_rate_or_amount}
                onChange={update("margin_rate_or_amount")}
              />
            </div>
          )}
        </div>
      </div>

      {isPriceDiscount && (
        <div className="pos-card mb-3 p-3 p-md-4">
          <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
            Price Discount Scheme
          </h6>
          <div className="row g-3">
            <div className="col-6 col-md-4">
              <SelectField
                label="Rate or Discount"
                value={form.rate_or_discount}
                onChange={update("rate_or_discount")}
                options={["Rate", "Discount Percentage", "Discount Amount"]}
              />
            </div>
            {isTransaction && form.rate_or_discount !== "Rate" && (
              <div className="col-6 col-md-4">
                <SelectField
                  label="Apply Discount On"
                  value={form.apply_discount_on}
                  onChange={update("apply_discount_on")}
                  options={["Grand Total", "Net Total"]}
                />
              </div>
            )}
            {form.rate_or_discount === "Rate" && (
              <div className="col-6 col-md-4">
                <CurrencyField label="Rate" currency={form.currency} value={form.rate} onChange={update("rate")} />
              </div>
            )}
            {form.rate_or_discount === "Discount Amount" && (
              <div className="col-6 col-md-4">
                <CurrencyField
                  label="Discount Amount"
                  currency={form.currency}
                  value={form.discount_amount}
                  onChange={update("discount_amount")}
                />
              </div>
            )}
            {form.rate_or_discount === "Discount Percentage" && (
              <div className="col-6 col-md-4">
                <NumberField
                  label="Discount Percentage"
                  value={form.discount_percentage}
                  onChange={update("discount_percentage")}
                  min={0}
                  max={100}
                />
              </div>
            )}
            {form.rate_or_discount !== "Rate" && (
              <div className="col-6 col-md-4">
                <LinkField
                  label="For Price List"
                  doctype="Price List"
                  value={form.for_price_list}
                  onChange={update("for_price_list")}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {isProductDiscount && (
        <div className="pos-card mb-3 p-3 p-md-4">
          <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
            Product Discount Scheme
          </h6>
          <div className="row g-3">
            {!isTransaction && !form.mixed_conditions && (
              <div className="col-6 col-md-4 d-flex align-items-center">
                <CheckboxField label="Same Item" checked={form.same_item} onChange={(v) => update("same_item")(v ? 1 : 0)} />
              </div>
            )}
            {(!form.same_item || isTransaction || form.mixed_conditions) && (
              <div className="col-6 col-md-4">
                <LinkField label="Free Item" doctype="Item" value={form.free_item} onChange={update("free_item")} />
              </div>
            )}
            <div className="col-6 col-md-4">
              <NumberField label="Free Qty" value={form.free_qty} onChange={update("free_qty")} min={0} />
            </div>
            <div className="col-6 col-md-4">
              <LinkField label="Free Item UOM" doctype="UOM" value={form.free_item_uom} onChange={update("free_item_uom")} />
            </div>
            <div className="col-6 col-md-4">
              <CurrencyField
                label="Free Item Rate"
                currency={form.currency}
                value={form.free_item_rate}
                onChange={update("free_item_rate")}
              />
            </div>
          </div>
        </div>
      )}

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Advanced Settings
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4 d-flex align-items-center">
            <CheckboxField
              label="Has Priority"
              checked={form.has_priority}
              onChange={(v) => update("has_priority")(v ? 1 : 0)}
            />
          </div>
          {form.has_priority ? (
            <div className="col-6 col-md-4">
              <SelectField
                label="Priority"
                placeholder="Select priority"
                value={form.priority}
                onChange={update("priority")}
                options={PRIORITY_OPTIONS}
              />
            </div>
          ) : null}
          <div className="col-6 col-md-4 d-flex align-items-center">
            <CheckboxField
              label="Apply Multiple Pricing Rules"
              checked={form.apply_multiple_pricing_rules}
              onChange={(v) => update("apply_multiple_pricing_rules")(v ? 1 : 0)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscountDetailPage;
