import { useEffect, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { fetchItemPrice, createItemPrice, saveItemPrice, fetchItemDetails, fetchPriceListDetails } from "../api/ItemPrice";
import {
  LinkField,
  CurrencyField,
  DateField,
  CheckboxField,
  TextField,
  PageLoader,
  PageHeader,
  ErrorAlert,
  SaveButton,
} from "../components/common";

const emptyItemPrice = {
  name: "",
  item_code: "",
  item_name: "",
  uom: "",
  price_list: "",
  customer: "",
  supplier: "",
  buying: 0,
  selling: 1,
  currency: "",
  price_list_rate: "",
  valid_from: "",
  valid_upto: "",
  note: "",
  modified: null,
};

const ItemPriceDetailPage = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const { setTopbar } = useOutletContext();
  const isEdit = Boolean(name);

  const [form, setForm] = useState(emptyItemPrice);
  const [fullDoc, setFullDoc] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEdit) {
      setForm(emptyItemPrice);
      setLoading(false);
      return;
    }
    fetchItemPrice(name).then((data) => {
      if (data) {
        setFullDoc(data);
        setForm({
          name: data.name,
          item_code: data.item_code ?? "",
          item_name: data.item_name ?? "",
          uom: data.uom ?? "",
          price_list: data.price_list ?? "",
          customer: data.customer ?? "",
          supplier: data.supplier ?? "",
          buying: data.buying ?? 0,
          selling: data.selling ?? 0,
          currency: data.currency ?? "",
          price_list_rate: data.price_list_rate ?? "",
          valid_from: data.valid_from ?? "",
          valid_upto: data.valid_upto ?? "",
          note: data.note ?? "",
          modified: data.modified,
        });
      }
      setLoading(false);
    });
  }, [isEdit, name]);

  useEffect(() => {
    setTopbar({ title: isEdit ? form.name || "Item Price" : "New Item Price" });
  }, [isEdit, form.name, setTopbar]);

  const update = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  // Mirrors item_price.js's onload() add_fetch("item_code", ...): Item Price's
  // item_name/uom are fetch_from Item's item_name/stock_uom.
  const handleItemChange = (value) => {
    setForm((f) => ({ ...f, item_code: value, item_name: "", uom: "" }));
    if (value) {
      fetchItemDetails(value).then((details) => {
        setForm((f) => ({ ...f, item_name: details?.item_name || "", uom: details?.stock_uom || "" }));
      });
    }
  };

  // Mirrors item_price.js's onload() add_fetch("price_list", ...): buying,
  // selling and currency are fetch_from (read-only) the selected Price List.
  const handlePriceListChange = (value) => {
    setForm((f) => ({ ...f, price_list: value, buying: 0, selling: 0, currency: "" }));
    if (value) {
      fetchPriceListDetails(value).then((details) => {
        setForm((f) => ({
          ...f,
          buying: details?.buying ?? 0,
          selling: details?.selling ?? 0,
          currency: details?.currency || "",
        }));
      });
    }
  };

  const handleSubmit = async () => {
    if (!form.item_code || !form.uom || !form.price_list || !form.price_list_rate) {
      setError("Item Code, UOM, Price List and Rate are required");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const payload = {
        item_code: form.item_code,
        uom: form.uom,
        price_list: form.price_list,
        customer: form.customer || undefined,
        supplier: form.supplier || undefined,
        buying: form.buying ? 1 : 0,
        selling: form.selling ? 1 : 0,
        currency: form.currency || undefined,
        price_list_rate: form.price_list_rate,
        valid_from: form.valid_from || undefined,
        valid_upto: form.valid_upto || undefined,
        note: form.note || undefined,
      };
      // Merge into the full fetched document so fields outside this editor
      // (creation, owner, ...) are preserved — frappe.client.save replaces
      // the whole document and set_only_once fields would otherwise fail.
      const saved = isEdit
        ? await saveItemPrice({ ...fullDoc, ...payload, name: form.name, modified: form.modified })
        : await createItemPrice(payload);

      // Editing the same doc keeps the same URL, so the fetch-on-mount effect
      // never reruns — refresh fullDoc/modified from the response here,
      // otherwise a second save in the same visit fails with
      // TimestampMismatchError against the now-stale `modified` we hold.
      setFullDoc(saved);
      setForm((f) => ({ ...f, modified: saved.modified }));

      if (!isEdit) {
        navigate(`/posapp/item-price/${encodeURIComponent(saved.name)}`, { replace: true });
      }
    } catch (err) {
      setError(err?.response?.data?.exc_type || "Failed to save Item Price");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="px-3 px-md-4 py-3 py-md-4">
      <PageHeader
        title={isEdit ? form.name : "New Item Price"}
        backTo="/posapp/item-price"
        backLabel="Item Prices"
        actions={<SaveButton saving={saving} onClick={handleSubmit} />}
      />

      <ErrorAlert message={error} />

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Item Details
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <LinkField
              label="Item"
              required
              doctype="Item"
              filters={{ has_variants: 0 }}
              value={form.item_code}
              displayValue={form.item_code}
              onChange={handleItemChange}
            />
          </div>
          <div className="col-6 col-md-4">
            <LinkField label="UOM" required doctype="UOM" value={form.uom} onChange={update("uom")} />
          </div>
          <div className="col-6 col-md-4">
            <TextField label="Item Name" value={form.item_name} disabled readOnly />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Price List Details
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <LinkField label="Price List" required doctype="Price List" value={form.price_list} onChange={handlePriceListChange} />
          </div>
          <div className="col-6 col-md-4">
            <LinkField label="Customer" doctype="Customer" value={form.customer} onChange={update("customer")} />
          </div>
          <div className="col-6 col-md-4">
            <LinkField label="Supplier" doctype="Supplier" value={form.supplier} onChange={update("supplier")} />
          </div>
          <div className="col-6 col-md-4 d-flex flex-wrap gap-4">
            <CheckboxField label="Buying" checked={form.buying} disabled />
            <CheckboxField label="Selling" checked={form.selling} disabled />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Rate
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <LinkField label="Currency" doctype="Currency" value={form.currency} disabled />
          </div>
          <div className="col-6 col-md-4">
            <CurrencyField label="Rate" required currency={form.currency} value={form.price_list_rate} onChange={update("price_list_rate")} />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Validity
        </h6>
        <div className="row g-3">
          <div className="col-6 col-md-4">
            <DateField label="Valid From" value={form.valid_from} onChange={update("valid_from")} />
          </div>
          <div className="col-6 col-md-4">
            <DateField label="Valid Upto" value={form.valid_upto} onChange={update("valid_upto")} />
          </div>
        </div>
      </div>

      <div className="pos-card mb-3 p-3 p-md-4">
        <h6 className="mb-3" style={{ fontSize: 13, fontWeight: 600 }}>
          Note
        </h6>
        <div className="row g-3">
          <div className="col-12">
            <TextField multiline rows={3} value={form.note} onChange={update("note")} placeholder="Optional note" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemPriceDetailPage;
