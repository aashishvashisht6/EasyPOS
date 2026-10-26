import { getServerMessage } from "../utils/serverError";
import { _t, useTranslation } from "../translation";
import { useEffect, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import {
  fetchPricingRule,
  createPricingRule,
  savePricingRule,
  fetchItemUoms,
  fetchPriceListCurrency,
  fetchItemsValidationData,
} from "../api/PricingRule";
import { toastSuccess, toastError } from "../store/toastStore";
import {
  TextField,
  NumberField,
  CurrencyField,
  SelectField,
  CheckboxField,
  DateField,
  LinkField,
  ChildTable,
  PageLoader,
  PageHeader,
  ErrorAlert,
  SaveButton,
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
  apply_rule_on_other: "",
  other_item_code: "",
  other_item_group: "",
  other_brand: "",
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
  round_free_qty: 0,
  dont_enforce_free_item_qty: 0,
  is_recursive: 0,
  recurse_for: "",
  apply_recursion_over: 0,
  threshold_percentage: "",
  has_priority: 0,
  priority: "",
  apply_multiple_pricing_rules: 0,
  apply_discount_on_rate: 0,
  validate_applied_rule: 0,
  rule_description: "",
  condition: "",
  modified: null,
};

const PRIORITY_OPTIONS = Array.from({ length: 20 }, (_, i) => String(i + 1));

// Mirrors pricing_rule.js's set_options_for_applicable_for.
const getApplicableForOptions = (selling, buying) => {
  const options = [];
  // _t: values stay English (ERPNext's option values); SelectField translates labels.
  if (selling) options.push(_t("Customer"), _t("Customer Group"), _t("Territory"), _t("Sales Partner"), _t("Campaign"));
  if (buying) options.push(_t("Supplier"), _t("Supplier Group"));
  return options;
};

// Mirrors pricing_rule.py's validate_condition regex check.
const CONDITION_ASSIGNMENT_RE = /[\w.:_]+\s*={1}\s*[\w.@'"]+/;

const DiscountDetailPage = () => {
  const { __ } = useTranslation();
  const { name } = useParams();
  const navigate = useNavigate();
  const { setTopbar } = useOutletContext();
  const isEdit = Boolean(name);

  const [form, setForm] = useState(emptyPricingRule);
  const [fullDoc, setFullDoc] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [itemUomOptions, setItemUomOptions] = useState({});

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
    setTopbar({ title: isEdit ? form.name || form.title || _t("Discount") : _t("New Discount") });
  }, [isEdit, form.name, form.title, setTopbar]);

  // Mirrors pricing_rule.js's selling/buying triggers calling
  // set_options_for_applicable_for — resets applicable_for if it falls
  // outside the options available for the current Selling/Buying state.
  useEffect(() => {
    const options = getApplicableForOptions(form.selling, form.buying);
    if (form.applicable_for && !options.includes(form.applicable_for)) {
      setForm((f) => ({ ...f, applicable_for: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.selling, form.buying]);

  const update = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  // Mirrors pricing_rule.js's rate_or_discount trigger: switching to "Rate"
  // clears For Price List (a Rate-type rule overrides the price list outright).
  const handleRateOrDiscountChange = (value) => {
    setForm((f) => ({ ...f, rate_or_discount: value, for_price_list: value === "Rate" ? "" : f.for_price_list }));
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
    setItemUomOptions((m) => {
      const next = { ...m };
      delete next[index];
      return next;
    });
  };

  // Mirrors pricing_rule.js's setup() get_query on the item row's UOM field —
  // restricts choices to UOMs actually defined for that item so a mismatched
  // UOM can't silently be picked (it would break rate/qty conversion later).
  const handleItemRowChange = (index, item_code) => {
    updateRow("items", index, { item_code, uom: "" });
    if (item_code) {
      fetchItemUoms(item_code).then((uoms) => {
        setItemUomOptions((m) => ({ ...m, [index]: uoms }));
      });
    } else {
      setItemUomOptions((m) => ({ ...m, [index]: undefined }));
    }
  };

  const validate = async () => {
    // --- validate_mandatory ---
    if (!form.title) return __("Title is required");
    if (form.has_priority && !form.priority) return __("Priority is mandatory");

    const applyOnTables = { "Item Code": "items", "Item Group": "item_groups", Brand: "brands" };
    const applyOnTable = applyOnTables[form.apply_on];
    if (applyOnTable && (form[applyOnTable] || []).filter((r) => Object.values(r).some(Boolean)).length < 1) {
      return __("{field} is not added in the table", { field: __(form.apply_on) });
    }

    if (form.applicable_for) {
      const fieldMap = {
        Customer: "customer",
        "Customer Group": "customer_group",
        Territory: "territory",
        "Sales Partner": "sales_partner",
        Campaign: "campaign",
        Supplier: "supplier",
        "Supplier Group": "supplier_group",
      };
      const fieldName = fieldMap[form.applicable_for];
      if (fieldName && !form[fieldName]) return __("{field} is required", { field: __(form.applicable_for) });
    }

    if (form.apply_rule_on_other) {
      const otherFieldMap = { "Item Code": "other_item_code", "Item Group": "other_item_group", Brand: "other_brand" };
      const otherField = otherFieldMap[form.apply_rule_on_other];
      if (otherField && !form[otherField]) {
        return __("For the 'Apply Rule On Other' condition the field {field} is mandatory", {
          field: __(form.apply_rule_on_other),
        });
      }
    }

    if (form.price_or_product_discount === "Price" && !form.rate_or_discount) {
      return __("Rate or Discount is required for the price discount.");
    }

    if (form.apply_discount_on_rate) {
      if (!form.priority) {
        return __("As the field 'Apply Discount on Discounted Rate' is enabled, the field 'Priority' is mandatory.");
      }
      if (Number(form.priority) === 1) {
        return __("As the field 'Apply Discount on Discounted Rate' is enabled, the value of the field 'Priority' should be more than 1.");
      }
    }

    // --- validate_duplicate_apply_on (+ validate_template_with_variant) ---
    if (form.apply_on === "Item Code") {
      const codes = form.items.map((r) => r.item_code).filter(Boolean);
      if (new Set(codes).size !== codes.length) return __("Duplicate Item Code found in the table");
      if (codes.length) {
        const items = await fetchItemsValidationData(codes);
        const variant = items.find((it) => it.variant_of && codes.includes(it.variant_of));
        if (variant) {
          return __("Variant {variant} and its template {template} cannot both be added to the same Pricing Rule", {
            variant: variant.name,
            template: variant.variant_of,
          });
        }
        // --- validate_max_discount ---
        if (form.rate_or_discount === "Discount Percentage") {
          for (const it of items) {
            if (it.max_discount && Number(form.discount_percentage) > Number(it.max_discount)) {
              return __("Max discount allowed for item: {item} is {pct}%", { item: it.name, pct: it.max_discount });
            }
          }
        }
      }
    } else if (form.apply_on === "Item Group") {
      const groups = form.item_groups.map((r) => r.item_group).filter(Boolean);
      if (new Set(groups).size !== groups.length) return __("Duplicate Item Group found in the table");
    } else if (form.apply_on === "Brand") {
      const brands = form.brands.map((r) => r.brand).filter(Boolean);
      if (new Set(brands).size !== brands.length) return __("Duplicate Brand found in the table");
    }

    // --- validate_applicable_for_selling_or_buying ---
    if (!form.selling && !form.buying) return __("Atleast one of the Selling or Buying must be selected");
    if (!form.selling && ["Customer", "Customer Group", "Territory", "Sales Partner", "Campaign"].includes(form.applicable_for)) {
      return __("Selling must be checked, if Applicable For is selected as {field}", { field: __(form.applicable_for) });
    }
    if (!form.buying && ["Supplier", "Supplier Group"].includes(form.applicable_for)) {
      return __("Buying must be checked, if Applicable For is selected as {field}", { field: __(form.applicable_for) });
    }

    // --- validate_min_max_amt / validate_min_max_qty ---
    if (form.min_amt && form.max_amt && Number(form.min_amt) > Number(form.max_amt)) {
      return __("Min Amt can not be greater than Max Amt");
    }
    if (form.min_qty && form.max_qty && Number(form.min_qty) > Number(form.max_qty)) {
      return __("Min Qty can not be greater than Max Qty");
    }

    // --- validate_recursion ---
    if (form.price_or_product_discount === "Product" && form.is_recursive) {
      if (Number(form.apply_recursion_over) > Number(form.min_qty || 0)) {
        return __("Min Qty should be greater than Recurse Over Qty");
      }
      if (Number(form.apply_recursion_over) < 0) return __("Recurse Over Qty cannot be less than 0");
    }

    // --- validate_rate_or_discount ---
    if (form.rate_or_discount === "Rate" && Number(form.rate) < 0) return __("Rate can not be negative");
    if (form.price_or_product_discount === "Product" && !form.free_item && form.mixed_conditions) {
      return __("Free item code is not selected");
    }

    // --- validate_price_list_with_currency ---
    if (form.currency && form.for_price_list) {
      const priceListCurrency = await fetchPriceListCurrency(form.for_price_list);
      if (priceListCurrency && form.currency !== priceListCurrency) {
        return __("Currency should be same as Price List Currency: {currency}", { currency: priceListCurrency });
      }
    }

    // --- validate_dates ---
    if (form.is_cumulative && !(form.valid_from && form.valid_upto)) {
      return __("Valid from and valid upto fields are mandatory for the cumulative");
    }
    if (form.valid_from && form.valid_upto && form.valid_from > form.valid_upto) {
      return __("Valid Upto Date cannot be before Valid From Date");
    }

    // --- validate_condition ---
    if (form.condition && form.condition.includes("=") && CONDITION_ASSIGNMENT_RE.test(form.condition)) {
      return __("Invalid condition expression");
    }

    // --- validate_mixed_with_recursion ---
    if (form.mixed_conditions && form.is_recursive) {
      return __("Recursive Discounts with Mixed condition is not supported by the system");
    }

    return "";
  };

  const handleSubmit = async () => {
    setError("");
    const validationError = await validate();
    if (validationError) {
      setError(validationError);
      return;
    }
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
      toastSuccess(__("Discount saved successfully"));
    } catch (err) {
      const message = getServerMessage(err) || __("Failed to save Discount");
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  const isTransaction = form.apply_on === "Transaction";
  const isPriceDiscount = form.price_or_product_discount === "Price";
  const isProductDiscount = form.price_or_product_discount === "Product";
  const applicableForOptions = getApplicableForOptions(form.selling, form.buying);

  return (
    <div className="px-3 px-md-4 py-3 py-md-4">
      <PageHeader
        title={isEdit ? form.name : __("New Discount")}
        backTo="/posapp/discounts"
        backLabel={__("Discounts")}
        actions={<SaveButton saving={saving} onClick={handleSubmit} />}
      />

      <ErrorAlert message={error} />

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          {__("Applicability")}
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <TextField label={__("Title")} required value={form.title} onChange={update("title")} />
          </div>
          <div className="col-6 col-md-4">
            <SelectField
              label={__("Apply On")}
              value={form.apply_on}
              onChange={update("apply_on")}
              options={[_t("Item Code"), _t("Item Group"), _t("Brand"), _t("Transaction")]}
            />
          </div>
          <div className="col-6 col-md-4">
            <SelectField
              label={__("Price or Product Discount")}
              value={form.price_or_product_discount}
              onChange={update("price_or_product_discount")}
              options={[_t("Price"), _t("Product")]}
            />
          </div>
          {!isTransaction && (
            <div className="col-6 col-md-4">
              <LinkField label={__("Warehouse")} doctype="Warehouse" value={form.warehouse} onChange={update("warehouse")} />
            </div>
          )}
          <div className="col-12 d-flex flex-wrap gap-4">
            {!isTransaction && (
              <>
                <CheckboxField
                  label={__("Mixed Conditions")}
                  checked={form.mixed_conditions}
                  onChange={(v) => update("mixed_conditions")(v ? 1 : 0)}
                />
                <CheckboxField
                  label={__("Is Cumulative")}
                  checked={form.is_cumulative}
                  onChange={(v) => update("is_cumulative")(v ? 1 : 0)}
                />
              </>
            )}
            <CheckboxField
              label={__("Coupon Code Based")}
              checked={form.coupon_code_based}
              onChange={(v) => update("coupon_code_based")(v ? 1 : 0)}
            />
            <CheckboxField label={__("Disabled")} checked={form.disable} onChange={(v) => update("disable")(v ? 1 : 0)} />
          </div>
        </div>
      </div>

      {form.apply_on === "Item Code" && (
        <div className="pos-card mb-3 p-3 p-md-4">
          <ChildTable
            title={__("Apply Rule On Item Code *")}
            onAddRow={() => addRow("items", { item_code: "", uom: "" })}
            rows={form.items}
            emptyMessage={__("No items added")}
            columns={[
              {
                key: "item_code",
                label: _t("Item Code"),
                width: "1.6fr",
                render: (row, idx) => (
                  <LinkField
                    placeholder={__("Select Item")}
                    doctype="Item"
                    value={row.item_code}
                    onChange={(v) => handleItemRowChange(idx, v)}
                  />
                ),
              },
              {
                key: "uom",
                label: _t("UOM"),
                width: "1fr",
                render: (row, idx) => (
                  <LinkField
                    placeholder={__("Select UOM")}
                    doctype="UOM"
                    value={row.uom}
                    filters={itemUomOptions[idx]?.length ? { name: ["in", itemUomOptions[idx]] } : undefined}
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
            title={__("Apply Rule On Item Group *")}
            onAddRow={() => addRow("item_groups", { item_group: "", uom: "" })}
            rows={form.item_groups}
            emptyMessage={__("No item groups added")}
            columns={[
              {
                key: "item_group",
                label: _t("Item Group"),
                width: "1.6fr",
                render: (row, idx) => (
                  <LinkField
                    placeholder={__("Select Item Group")}
                    doctype="Item Group"
                    value={row.item_group}
                    onChange={(v) => updateRow("item_groups", idx, { item_group: v })}
                  />
                ),
              },
              {
                key: "uom",
                label: _t("UOM"),
                width: "1fr",
                render: (row, idx) => (
                  <LinkField
                    placeholder={__("Select UOM")}
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
            title={__("Apply Rule On Brand *")}
            onAddRow={() => addRow("brands", { brand: "", uom: "" })}
            rows={form.brands}
            emptyMessage={__("No brands added")}
            columns={[
              {
                key: "brand",
                label: _t("Brand"),
                width: "1.6fr",
                render: (row, idx) => (
                  <LinkField
                    placeholder={__("Select Brand")}
                    doctype="Brand"
                    value={row.brand}
                    onChange={(v) => updateRow("brands", idx, { brand: v })}
                  />
                ),
              },
              {
                key: "uom",
                label: _t("UOM"),
                width: "1fr",
                render: (row, idx) => (
                  <LinkField
                    placeholder={__("Select UOM")}
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

      {!isTransaction && !form.mixed_conditions && (
        <div className="pos-card mb-3 p-3 p-md-4">
          <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
            {__("Discount on Other Item")}
          </h6>
          <div className="row g-3">
            <div className="col-6 col-md-4">
              <SelectField
                label={__("Apply Rule On Other")}
                placeholder={__("None")}
                value={form.apply_rule_on_other}
                onChange={update("apply_rule_on_other")}
                options={[_t("Item Code"), _t("Item Group"), _t("Brand")]}
              />
            </div>
            {form.apply_rule_on_other === "Item Code" && (
              <div className="col-6 col-md-4">
                <LinkField label={__("Item Code")} required doctype="Item" value={form.other_item_code} onChange={update("other_item_code")} />
              </div>
            )}
            {form.apply_rule_on_other === "Item Group" && (
              <div className="col-6 col-md-4">
                <LinkField
                  label={__("Item Group")}
                  required
                  doctype="Item Group"
                  value={form.other_item_group}
                  onChange={update("other_item_group")}
                />
              </div>
            )}
            {form.apply_rule_on_other === "Brand" && (
              <div className="col-6 col-md-4">
                <LinkField label={__("Brand")} required doctype="Brand" value={form.other_brand} onChange={update("other_brand")} />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          {__("Party Information")}
        </h6>
        <div className="row g-3">
          <div className="col-12 d-flex flex-wrap gap-4">
            <CheckboxField label={__("Selling")} checked={form.selling} onChange={(v) => update("selling")(v ? 1 : 0)} />
            <CheckboxField label={__("Buying")} checked={form.buying} onChange={(v) => update("buying")(v ? 1 : 0)} />
          </div>
          {(form.selling || form.buying) && (
            <div className="col-6 col-md-4">
              <SelectField
                label={__("Applicable For")}
                placeholder={__("All")}
                value={form.applicable_for}
                onChange={update("applicable_for")}
                options={applicableForOptions}
              />
            </div>
          )}
          {form.applicable_for === "Customer" && (
            <div className="col-6 col-md-4">
              <LinkField label={__("Customer")} required doctype="Customer" value={form.customer} onChange={update("customer")} />
            </div>
          )}
          {form.applicable_for === "Customer Group" && (
            <div className="col-6 col-md-4">
              <LinkField
                label={__("Customer Group")}
                required
                doctype="Customer Group"
                value={form.customer_group}
                onChange={update("customer_group")}
              />
            </div>
          )}
          {form.applicable_for === "Territory" && (
            <div className="col-6 col-md-4">
              <LinkField label={__("Territory")} required doctype="Territory" value={form.territory} onChange={update("territory")} />
            </div>
          )}
          {form.applicable_for === "Sales Partner" && (
            <div className="col-6 col-md-4">
              <LinkField
                label={__("Sales Partner")}
                required
                doctype="Sales Partner"
                value={form.sales_partner}
                onChange={update("sales_partner")}
              />
            </div>
          )}
          {form.applicable_for === "Campaign" && (
            <div className="col-6 col-md-4">
              <LinkField label={__("Campaign")} required doctype="Campaign" value={form.campaign} onChange={update("campaign")} />
            </div>
          )}
          {form.applicable_for === "Supplier" && (
            <div className="col-6 col-md-4">
              <LinkField label={__("Supplier")} required doctype="Supplier" value={form.supplier} onChange={update("supplier")} />
            </div>
          )}
          {form.applicable_for === "Supplier Group" && (
            <div className="col-6 col-md-4">
              <LinkField
                label={__("Supplier Group")}
                required
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
          {__("Quantity and Amount")}
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-3">
            <NumberField label={__("Min Qty (Stock UOM)")} value={form.min_qty} onChange={update("min_qty")} />
          </div>
          <div className="col-6 col-md-3">
            <NumberField label={__("Max Qty (Stock UOM)")} value={form.max_qty} onChange={update("max_qty")} />
          </div>
          <div className="col-6 col-md-3">
            <CurrencyField label={__("Min Amount")} currency={form.currency} value={form.min_amt} onChange={update("min_amt")} />
          </div>
          <div className="col-6 col-md-3">
            <CurrencyField label={__("Max Amount")} currency={form.currency} value={form.max_amt} onChange={update("max_amt")} />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          {__("Period Settings")}
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-3">
            <DateField
              label={__("Valid From")}
              required={Boolean(form.is_cumulative)}
              value={form.valid_from}
              onChange={update("valid_from")}
            />
          </div>
          <div className="col-6 col-md-3">
            <DateField
              label={__("Valid Upto")}
              required={Boolean(form.is_cumulative)}
              value={form.valid_upto}
              onChange={update("valid_upto")}
            />
          </div>
          <div className="col-6 col-md-3">
            <LinkField label={__("Company")} doctype="Company" value={form.company} onChange={update("company")} />
          </div>
          <div className="col-6 col-md-3">
            <LinkField label={__("Currency")} required doctype="Currency" value={form.currency} onChange={update("currency")} />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          {__("Margin")}
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <SelectField
              label={__("Margin Type")}
              value={form.margin_type}
              onChange={update("margin_type")}
              options={["", _t("Percentage"), _t("Amount")]}
            />
          </div>
          {form.margin_type && (
            <div className="col-6 col-md-4">
              <NumberField
                label={__("Margin Rate or Amount")}
                help={form.margin_type === "Percentage" ? __("In Percentage %") : __("In Amount")}
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
            {__("Price Discount Scheme")}
          </h6>
          <div className="row g-3">
            <div className="col-6 col-md-4">
              <SelectField
                label={__("Rate or Discount")}
                required
                value={form.rate_or_discount}
                onChange={handleRateOrDiscountChange}
                options={[_t("Rate"), _t("Discount Percentage"), _t("Discount Amount")]}
              />
            </div>
            {isTransaction && form.rate_or_discount !== "Rate" && (
              <div className="col-6 col-md-4">
                <SelectField
                  label={__("Apply Discount On")}
                  value={form.apply_discount_on}
                  onChange={update("apply_discount_on")}
                  options={[_t("Grand Total"), _t("Net Total")]}
                />
              </div>
            )}
            {form.rate_or_discount === "Rate" && (
              <div className="col-6 col-md-4">
                <CurrencyField label={__("Rate")} currency={form.currency} value={form.rate} onChange={update("rate")} />
              </div>
            )}
            {form.rate_or_discount === "Discount Amount" && (
              <div className="col-6 col-md-4">
                <CurrencyField
                  label={__("Discount Amount")}
                  currency={form.currency}
                  value={form.discount_amount}
                  onChange={update("discount_amount")}
                />
              </div>
            )}
            {form.rate_or_discount === "Discount Percentage" && (
              <div className="col-6 col-md-4">
                <NumberField
                  label={__("Discount Percentage")}
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
                  label={__("For Price List")}
                  doctype="Price List"
                  value={form.for_price_list}
                  filters={{
                    ...(form.selling ? { selling: 1 } : {}),
                    ...(form.buying ? { buying: 1 } : {}),
                    ...(form.currency ? { currency: form.currency } : {}),
                  }}
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
            {__("Product Discount Scheme")}
          </h6>
          <div className="row g-3">
            {!isTransaction && !form.mixed_conditions && (
              <div className="col-6 col-md-4">
                <CheckboxField label={__("Same Item")} checked={form.same_item} onChange={(v) => update("same_item")(v ? 1 : 0)} />
              </div>
            )}
            {(!form.same_item || isTransaction || form.mixed_conditions) && (
              <div className="col-6 col-md-4">
                <LinkField label={__("Free Item")} doctype="Item" value={form.free_item} onChange={update("free_item")} />
              </div>
            )}
            <div className="col-6 col-md-4">
              <NumberField label={__("Free Qty")} value={form.free_qty} onChange={update("free_qty")} min={0} />
            </div>
            <div className="col-6 col-md-4">
              <LinkField label={__("Free Item UOM")} doctype="UOM" value={form.free_item_uom} onChange={update("free_item_uom")} />
            </div>
            <div className="col-6 col-md-4">
              <CurrencyField
                label={__("Free Item Rate")}
                help={__('If rate is zero then item will be treated as "Free Item"')}
                currency={form.currency}
                value={form.free_item_rate}
                onChange={update("free_item_rate")}
              />
            </div>
            <div className="col-12 d-flex flex-wrap gap-4">
              <CheckboxField
                label={__("Round Free Qty")}
                checked={form.round_free_qty}
                onChange={(v) => update("round_free_qty")(v ? 1 : 0)}
              />
              <CheckboxField
                label={__("Don't Enforce Free Item Qty")}
                checked={form.dont_enforce_free_item_qty}
                onChange={(v) => update("dont_enforce_free_item_qty")(v ? 1 : 0)}
              />
              <CheckboxField
                label={__("Is Recursive")}
                checked={form.is_recursive}
                onChange={(v) => update("is_recursive")(v ? 1 : 0)}
              />
            </div>
            {Boolean(form.is_recursive) && (
              <>
                <div className="col-6 col-md-4">
                  <NumberField
                    label={__("Recurse Every (As Per Transaction UOM)")}
                    required
                    help={__("Give free item for every N quantity")}
                    value={form.recurse_for}
                    onChange={update("recurse_for")}
                  />
                </div>
                <div className="col-6 col-md-4">
                  <NumberField
                    label={__("Apply Recursion Over (As Per Transaction UOM)")}
                    help={__("Qty for which recursion isn't applicable.")}
                    value={form.apply_recursion_over}
                    onChange={update("apply_recursion_over")}
                    min={0}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          {__("Dynamic Condition")}
        </h6>
        <div className="row g-3">
          <div className="col-12">
            <TextField
              label={__("Condition")}
              multiline
              rows={2}
              help={__("Simple Python Expression, Example: territory != 'All Territories'")}
              value={form.condition}
              onChange={update("condition")}
            />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          {__("Advanced Settings")}
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <NumberField
              label={__("Threshold for Suggestion (In Percentage)")}
              help={__("System will notify to increase or decrease quantity or amount")}
              value={form.threshold_percentage}
              onChange={update("threshold_percentage")}
              min={0}
              max={100}
              suffix="%"
            />
          </div>
          <div className="col-6 col-md-4">
            <CheckboxField
              label={__("Has Priority")}
              checked={form.has_priority}
              onChange={(v) => update("has_priority")(v ? 1 : 0)}
            />
          </div>
          {form.has_priority ? (
            <div className="col-6 col-md-4">
              <SelectField
                label={__("Priority")}
                placeholder={__("Select priority")}
                required
                value={form.priority}
                onChange={update("priority")}
                options={PRIORITY_OPTIONS}
              />
            </div>
          ) : null}
          <div className="col-6 col-md-4">
            <CheckboxField
              label={__("Apply Multiple Pricing Rules")}
              checked={form.apply_multiple_pricing_rules}
              onChange={(v) => update("apply_multiple_pricing_rules")(v ? 1 : 0)}
            />
          </div>
          {form.rate_or_discount === "Discount Percentage" && form.apply_multiple_pricing_rules ? (
            <div className="col-6 col-md-4">
              <CheckboxField
                label={__("Apply Discount on Discounted Rate")}
                checked={form.apply_discount_on_rate}
                onChange={(v) => update("apply_discount_on_rate")(v ? 1 : 0)}
              />
            </div>
          ) : null}
          {isPriceDiscount && (
            <div className="col-6 col-md-4">
              <CheckboxField
                label={__("Validate Applied Rule")}
                help={__("If enabled, the system only validates the rule instead of applying it automatically")}
                checked={form.validate_applied_rule}
                onChange={(v) => update("validate_applied_rule")(v ? 1 : 0)}
              />
            </div>
          )}
          {Boolean(form.validate_applied_rule) && (
            <div className="col-12">
              <TextField label={__("Rule Description")} multiline rows={2} value={form.rule_description} onChange={update("rule_description")} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscountDetailPage;
