import { useEffect, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { fetchProfile, createProfile, saveProfile, fetchCompanyDefaults } from "../api/POSProfile";
import {
  LinkField,
  CheckboxField,
  CurrencyField,
  SelectField,
  ChildTable,
  PageLoader,
  PageHeader,
  ErrorAlert,
  SaveButton,
} from "../components/common";

const emptyProfile = {
  name: "",
  company: "",
  customer: "",
  warehouse: "",
  campaign: "",
  company_address: "",
  disabled: 0,
  applicable_for_users: [],
  payments: [],
  hide_images: 0,
  hide_unavailable_items: 0,
  auto_add_item_to_cart: 0,
  validate_stock_on_save: 0,
  print_receipt_on_order_complete: 0,
  ignore_pricing_rule: 0,
  allow_rate_change: 0,
  allow_discount_change: 0,
  disable_grand_total_to_default_mop: 0,
  allow_partial_payment: 0,
  item_groups: [],
  customer_groups: [],
  print_format: "",
  ep_email_notification: "",
  ep_sms_notification: "",
  letter_head: "",
  tc_name: "",
  select_print_heading: "",
  selling_price_list: "",
  currency: "",
  write_off_account: "",
  write_off_cost_center: "",
  write_off_limit: 1,
  account_for_change_amount: "",
  disable_rounded_total: 0,
  income_account: "",
  expense_account: "",
  taxes_and_charges: "",
  tax_category: "",
  apply_discount_on: "Grand Total",
  cost_center: "",
  project: "",
  modified: null,
};

const POSProfileDetailPage = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const { setTopbar } = useOutletContext();
  const isEdit = Boolean(name);

  const [form, setForm] = useState(emptyProfile);
  const [fullDoc, setFullDoc] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [perpetualInventoryEnabled, setPerpetualInventoryEnabled] = useState(false);

  useEffect(() => {
    if (!isEdit) {
      setForm(emptyProfile);
      setLoading(false);
      return;
    }
    fetchProfile(name).then((data) => {
      if (data) {
        setFullDoc(data);
        setForm({
          ...emptyProfile,
          ...data,
          modified: data.modified,
        });
        if (data.company) {
          fetchCompanyDefaults(data.company).then((defaults) => {
            setPerpetualInventoryEnabled(!!defaults?.enable_perpetual_inventory);
          });
        }
      }
      setLoading(false);
    });
  }, [isEdit, name]);

  useEffect(() => {
    setTopbar({ title: isEdit ? form.name || "POS Profile" : "New POS Profile" });
  }, [isEdit, form.name, setTopbar]);

  const update = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  // Mirrors pos_profile.js's `company` trigger: fetches the Company's default
  // letter head and its perpetual-inventory setting (which controls whether
  // Expense Account is shown at all).
  const handleCompanyChange = (value) => {
    setForm((f) => ({ ...f, company: value }));
    if (!value) {
      setPerpetualInventoryEnabled(false);
      return;
    }
    fetchCompanyDefaults(value).then((defaults) => {
      setPerpetualInventoryEnabled(!!defaults?.enable_perpetual_inventory);
      if (defaults?.default_letter_head) {
        setForm((f) => ({ ...f, letter_head: defaults.default_letter_head }));
      }
    });
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
    if (!form.company || !form.warehouse) {
      setError("Company and Warehouse are required");
      return;
    }

    const payments = form.payments.filter((r) => r.mode_of_payment);
    const item_groups = form.item_groups.filter((r) => r.item_group);
    const customer_groups = form.customer_groups.filter((r) => r.customer_group);

    // Mirrors pos_profile.py's validate_payment_methods: at least one row,
    // and exactly one of them marked default.
    if (payments.length === 0) {
      setError("Payment methods are mandatory. Please add at least one payment method.");
      return;
    }
    const defaultModeCount = payments.filter((r) => r.default).length;
    if (defaultModeCount === 0) {
      setError("Please select a default mode of payment");
      return;
    }
    if (defaultModeCount > 1) {
      setError("You can only select one mode of payment as default");
      return;
    }

    // Mirrors pos_profile.py's validate_duplicate_groups.
    const itemGroupNames = item_groups.map((r) => r.item_group);
    if (new Set(itemGroupNames).size !== itemGroupNames.length) {
      setError("Duplicate item group found in the item group table");
      return;
    }
    const customerGroupNames = customer_groups.map((r) => r.customer_group);
    if (new Set(customerGroupNames).size !== customerGroupNames.length) {
      setError("Duplicate customer group found in the customer group table");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        applicable_for_users: form.applicable_for_users.filter((r) => r.user),
        payments,
        item_groups,
        customer_groups,
      };
      // Merge into the full fetched document so fields outside this form
      // (creation, owner, ...) are preserved — frappe.client.save replaces
      // the whole document and set_only_once fields would otherwise fail.
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

  if (loading) return <PageLoader />;

  return (
    <div className="px-3 px-md-4 py-3 py-md-4">
      <PageHeader
        title={isEdit ? form.name : "New POS Profile"}
        backTo="/posapp/pos-profile"
        backLabel="POS Profiles"
        actions={<SaveButton saving={saving} onClick={handleSubmit} />}
      />

      <ErrorAlert message={error} />

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Profile Info
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <LinkField label="Company" required doctype="Company" value={form.company} onChange={handleCompanyChange} />
          </div>
          <div className="col-6 col-md-4">
            <LinkField label="Customer" doctype="Customer" value={form.customer} onChange={update("customer")} />
          </div>
          <div className="col-6 col-md-4">
            <LinkField
              label="Warehouse"
              required
              doctype="Warehouse"
              filters={[
                ["Warehouse", "company", "in", ["", form.company]],
                ["Warehouse", "is_group", "=", 0],
              ]}
              value={form.warehouse}
              onChange={update("warehouse")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField label="Campaign" doctype="Campaign" value={form.campaign} onChange={update("campaign")} />
          </div>
          <div className="col-6 col-md-4">
            <LinkField
              label="Company Address"
              doctype="Address"
              help={!form.company ? "Select a Company first" : undefined}
              filters={
                form.company
                  ? [
                      ["Dynamic Link", "link_doctype", "=", "Company"],
                      ["Dynamic Link", "link_name", "=", form.company],
                    ]
                  : undefined
              }
              value={form.company_address}
              onChange={update("company_address")}
            />
          </div>
          <div className="col-6 col-md-4">
            <CheckboxField label="Disabled" checked={form.disabled} onChange={(v) => update("disabled")(v ? 1 : 0)} />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <ChildTable
          title="Applicable for Users"
          description="Leave empty to make this profile applicable for all users."
          onAddRow={() => addRow("applicable_for_users", { user: "", default: 0 })}
          rows={form.applicable_for_users}
          emptyMessage="No users added — applies to all users"
          columns={[
            {
              key: "user",
              label: "User",
              width: "2fr",
              render: (row, idx) => (
                <LinkField
                  placeholder="Select User"
                  doctype="User"
                  value={row.user}
                  onChange={(v) => updateRow("applicable_for_users", idx, { user: v })}
                />
              ),
            },
            {
              key: "default",
              label: "Default",
              width: "1fr",
              render: (row, idx) => (
                <CheckboxField
                  dense
                  label="Default"
                  checked={row.default}
                  onChange={(v) => updateRow("applicable_for_users", idx, { default: v ? 1 : 0 })}
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
                  onClick={() => removeRow("applicable_for_users", idx)}
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
          title="Payment Methods"
          onAddRow={() =>
            addRow("payments", { mode_of_payment: "", default: 0, allow_in_returns: 0, ep_automatically_calculated: 1 })
          }
          rows={form.payments}
          emptyMessage="No payment modes added"
          columns={[
            {
              key: "mode_of_payment",
              label: "Mode of Payment",
              width: "1.4fr",
              render: (row, idx) => (
                <LinkField
                  placeholder="Select Mode"
                  doctype="Mode of Payment"
                  value={row.mode_of_payment}
                  onChange={(v) => updateRow("payments", idx, { mode_of_payment: v })}
                />
              ),
            },
            {
              key: "default",
              label: "Default",
              width: "0.7fr",
              render: (row, idx) => (
                <CheckboxField
                  dense
                  label="Default"
                  checked={row.default}
                  onChange={(v) => updateRow("payments", idx, { default: v ? 1 : 0 })}
                />
              ),
            },
            {
              key: "allow_in_returns",
              label: "Allow in Returns",
              width: "0.9fr",
              render: (row, idx) => (
                <CheckboxField
                  dense
                  label="Allow in Returns"
                  checked={row.allow_in_returns}
                  onChange={(v) => updateRow("payments", idx, { allow_in_returns: v ? 1 : 0 })}
                />
              ),
            },
            {
              key: "ep_automatically_calculated",
              label: "Automatically Calculated",
              width: "1fr",
              render: (row, idx) => (
                <div>
                  <CheckboxField
                    dense
                    label="Automatically Calculated"
                    checked={row.ep_automatically_calculated ?? 1}
                    onChange={(v) => updateRow("payments", idx, { ep_automatically_calculated: v ? 1 : 0 })}
                  />
                  <div className="pos-field-description" style={{ fontSize: 11, color: "var(--color-text-faint)", marginTop: 2 }}>
                    When checked, the closing amount for this payment method is calculated
                    automatically from sales. Uncheck to have the cashier manually count and
                    enter the amount at POS closing.
                  </div>
                </div>
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
                  onClick={() => removeRow("payments", idx)}
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
          Configuration
        </h6>
        <div className="row g-3">
          {[
            ["hide_images", "Hide Images"],
            ["hide_unavailable_items", "Hide Unavailable Items"],
            ["auto_add_item_to_cart", "Automatically Add Filtered Item To Cart"],
            ["validate_stock_on_save", "Validate Stock on Save"],
            ["print_receipt_on_order_complete", "Print Receipt on Order Complete"],
            ["ignore_pricing_rule", "Ignore Pricing Rule"],
            ["allow_rate_change", "Allow User to Edit Rate"],
            ["allow_discount_change", "Allow User to Edit Discount"],
            ["disable_grand_total_to_default_mop", "Disable auto-setting Grand Total to default Mode of Payment"],
            ["allow_partial_payment", "Allow Partial Payment"],
          ].map(([field, label]) => (
            <div className="col-6 col-md-4" key={field}>
              <CheckboxField label={label} checked={form[field]} onChange={(v) => update(field)(v ? 1 : 0)} />
            </div>
          ))}
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <div className="row g-3">
          <div className="col-md-6">
            <ChildTable
              title="Item Groups"
              description="Only show Items from these Item Groups. Leave empty for all."
              onAddRow={() => addRow("item_groups", { item_group: "" })}
              rows={form.item_groups}
              emptyMessage="No item groups added"
              columns={[
                {
                  key: "item_group",
                  label: "Item Group",
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

          <div className="col-md-6">
            <ChildTable
              title="Customer Groups"
              description="Only show Customers of these Customer Groups. Leave empty for all."
              onAddRow={() => addRow("customer_groups", { customer_group: "" })}
              rows={form.customer_groups}
              emptyMessage="No customer groups added"
              columns={[
                {
                  key: "customer_group",
                  label: "Customer Group",
                  render: (row, idx) => (
                    <LinkField
                      placeholder="Select Customer Group"
                      doctype="Customer Group"
                      value={row.customer_group}
                      onChange={(v) => updateRow("customer_groups", idx, { customer_group: v })}
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
                      onClick={() => removeRow("customer_groups", idx)}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Print Settings
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-3">
            <LinkField
              label="Print Format"
              doctype="Print Format"
              filters={[["Print Format", "doc_type", "=", "POS Invoice"]]}
              value={form.print_format}
              onChange={update("print_format")}
            />
          </div>
          <div className="col-6 col-md-3">
            <LinkField label="Letter Head" doctype="Letter Head" value={form.letter_head} onChange={update("letter_head")} />
          </div>
          <div className="col-6 col-md-3">
            <LinkField
              label="Terms and Conditions"
              doctype="Terms and Conditions"
              filters={{ selling: 1 }}
              value={form.tc_name}
              onChange={update("tc_name")}
            />
          </div>
          <div className="col-6 col-md-3">
            <LinkField
              label="Print Heading"
              doctype="Print Heading"
              filters={[["Print Heading", "docstatus", "!=", 2]]}
              value={form.select_print_heading}
              onChange={update("select_print_heading")}
            />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Receipt Delivery
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <LinkField
              label="Email Notification"
              doctype="Notification"
              filters={[["Notification", "channel", "=", "Email"]]}
              value={form.ep_email_notification}
              onChange={update("ep_email_notification")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField
              label="SMS Notification"
              doctype="Notification"
              filters={[["Notification", "channel", "=", "SMS"]]}
              value={form.ep_sms_notification}
              onChange={update("ep_sms_notification")}
            />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Accounting
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <LinkField
              label="Price List"
              doctype="Price List"
              filters={{ selling: 1 }}
              value={form.selling_price_list}
              onChange={update("selling_price_list")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField label="Currency" required doctype="Currency" value={form.currency} onChange={update("currency")} />
          </div>
          <div className="col-6 col-md-4">
            <LinkField
              label="Write Off Account"
              required
              doctype="Account"
              filters={
                form.company
                  ? { report_type: "Profit and Loss", is_group: 0, company: form.company }
                  : undefined
              }
              value={form.write_off_account}
              onChange={update("write_off_account")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField
              label="Write Off Cost Center"
              required
              doctype="Cost Center"
              filters={form.company ? { is_group: 0, company: form.company } : undefined}
              value={form.write_off_cost_center}
              onChange={update("write_off_cost_center")}
            />
          </div>
          <div className="col-6 col-md-4">
            <CurrencyField
              label="Write Off Limit"
              required
              currency={form.currency}
              value={form.write_off_limit}
              onChange={update("write_off_limit")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField
              label="Account for Change Amount"
              doctype="Account"
              help={!form.company ? "Select a Company first" : undefined}
              filters={
                form.company
                  ? { account_type: ["in", ["Cash", "Bank"]], is_group: 0, company: form.company }
                  : undefined
              }
              value={form.account_for_change_amount}
              onChange={update("account_for_change_amount")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField
              label="Income Account"
              doctype="Account"
              help={!form.company ? "Select a Company first" : undefined}
              filters={
                form.company
                  ? { is_group: 0, company: form.company, account_type: "Income Account" }
                  : undefined
              }
              value={form.income_account}
              onChange={update("income_account")}
            />
          </div>
          {perpetualInventoryEnabled && (
            <div className="col-6 col-md-4">
              <LinkField
                label="Expense Account"
                doctype="Account"
                filters={
                  form.company
                    ? { report_type: "Profit and Loss", company: form.company, is_group: 0 }
                    : undefined
                }
                value={form.expense_account}
                onChange={update("expense_account")}
              />
            </div>
          )}
          <div className="col-6 col-md-4">
            <LinkField
              label="Sales Taxes and Charges Template"
              doctype="Sales Taxes and Charges Template"
              filters={
                form.company
                  ? [
                      ["Sales Taxes and Charges Template", "company", "=", form.company],
                      ["Sales Taxes and Charges Template", "docstatus", "!=", 2],
                    ]
                  : undefined
              }
              value={form.taxes_and_charges}
              onChange={update("taxes_and_charges")}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField label="Tax Category" doctype="Tax Category" value={form.tax_category} onChange={update("tax_category")} />
          </div>
          <div className="col-6 col-md-4">
            <SelectField
              label="Apply Discount On"
              value={form.apply_discount_on}
              onChange={update("apply_discount_on")}
              options={["Grand Total", "Net Total"]}
            />
          </div>
          <div className="col-6 col-md-4">
            <CheckboxField
              label="Disable Rounded Total"
              checked={form.disable_rounded_total}
              onChange={(v) => update("disable_rounded_total")(v ? 1 : 0)}
            />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Accounting Dimensions
        </h6>
        <div className="row g-3">
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

export default POSProfileDetailPage;
