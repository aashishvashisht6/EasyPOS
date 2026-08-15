import axios from "../api/config";
import db from "./db";

// Offline write queue for Sales Invoice creation (easy_pos.api.pos.create_invoice).
// engine/index.js diverts a create_invoice call here instead of the network when
// offline mode is on and connectivity is down; connectivity.js's heartbeat (and
// the Sync page's manual "Push now") drain the queue once back online.
const PUSH_URL = "/api/method/easy_pos.api.sync.push_offline_invoice";

const genOfflineId = () =>
	typeof crypto !== "undefined" && crypto.randomUUID
		? crypto.randomUUID()
		: `off-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Cashier-facing label for an invoice that doesn't have a real ERPNext name
// yet — shown on the receipt, in the Invoices list, and in InvoiceDetailPage
// until the queue entry syncs and erpnext_name is filled in.
const genDisplayId = () => {
	const stamp = new Date()
		.toISOString()
		.replace(/[-:TZ.]/g, "")
		.slice(0, 14); // YYYYMMDDHHMMSS
	const suffix = Math.floor(100 + Math.random() * 900);
	return `OFFLINE-${stamp}-${suffix}`;
};

export const isOfflineDisplayId = (value) =>
	typeof value === "string" && value.startsWith("OFFLINE-");

// A cart's salesInvoiceName can itself be an offline display_id (set from a
// prior queueOfflineInvoice/updateQueuedInvoice response — see Cart/index.jsx
// and InvoicePay/index.jsx) rather than a real ERPNext Sales Invoice name.
// Sending that straight through as `invoice.sales_invoice` would make the
// backend's _save_sales_invoice try frappe.get_doc on a name that was never
// actually inserted, throwing DoesNotExistError once the row is pushed — so
// every payload stored in (or sent from) the queue has it stripped here
// first. There is never a legitimate case where sales_invoice should hold an
// offline display_id: an update to an already-synced invoice uses its real
// erpnext_name instead (see updateQueuedInvoice's `synced` branch).
const sanitizeInvoicePayload = (invoice) => {
	if (invoice?.sales_invoice && isOfflineDisplayId(invoice.sales_invoice)) {
		// eslint-disable-next-line no-unused-vars
		const { sales_invoice, ...rest } = invoice;
		return rest;
	}
	return invoice;
};

const extractErrorMessage = (err) => {
	const serverMessages = err?.response?.data?._server_messages;
	if (serverMessages) {
		try {
			const parsed = JSON.parse(JSON.parse(serverMessages)[0]);
			if (parsed?.message) return parsed.message;
		} catch {
			// fall through to the generic message below
		}
	}
	return err?.response?.data?.exception || err?.message || "Failed to sync invoice";
};

// Queues a create_invoice call locally and returns a response shaped like the
// real endpoint's ({ data: { message: {...} } }), so postDraftInvoice/
// postPaymentInvoice (api/Invoice.js) and their callers (Cart, InvoicePay)
// don't need to know or care whether the invoice actually reached the server.
export const queueOfflineInvoice = async ({ invoice, opening_details, submit, coupon_code }) => {
	const cleanInvoice = sanitizeInvoicePayload(invoice);
	const offline_id = genOfflineId();
	const display_id = genDisplayId();
	const now = new Date().toISOString();

	await db.pending_invoices.put({
		offline_id,
		display_id,
		status: "queued",
		submit: !!submit,
		payload: { invoice: cleanInvoice, opening_details, coupon_code },
		erpnext_name: null,
		error: null,
		attempts: 0,
		created_at: now,
		updated_at: now,
	});

	return {
		data: {
			message: {
				name: display_id,
				docstatus: submit ? 1 : 0,
				customer: cleanInvoice?.customer,
				items: cleanInvoice?.items,
				payments: cleanInvoice?.payments,
				__offline: true,
				offline_id,
			},
		},
	};
};

// Updates an existing queued row in place (Cart/InvoicePay resuming a held
// offline draft, see Cart/index.jsx's selectDraft) instead of queueing a
// second, duplicate offline invoice for the same sale. Pure local Dexie
// write, safe to call regardless of current connectivity.
//
// Guards against the narrow race where the row was already pushed to
// ERPNext in the background (a reconnect happened while the draft picker was
// open) between being listed and being resumed — in that case nothing local
// is mutated and { synced: true, name } is returned so the caller falls back
// to the normal online resume path (fetch the real doc, update it with
// sales_invoice set to that real name) instead of silently re-queuing an
// invoice that already exists.
export const updateQueuedInvoice = async (
	offline_id,
	{ invoice, opening_details, submit, coupon_code }
) => {
	const row = await db.pending_invoices.get(offline_id);
	if (!row) return null;
	if (row.status === "synced") {
		return { synced: true, name: row.erpnext_name };
	}

	const cleanInvoice = sanitizeInvoicePayload(invoice);

	await db.pending_invoices.update(offline_id, {
		status: "queued",
		submit: !!submit,
		payload: { invoice: cleanInvoice, opening_details, coupon_code },
		error: null,
		updated_at: new Date().toISOString(),
	});

	return {
		data: {
			message: {
				name: row.display_id,
				docstatus: submit ? 1 : 0,
				customer: cleanInvoice?.customer,
				items: cleanInvoice?.items,
				payments: cleanInvoice?.payments,
				__offline: true,
				offline_id,
			},
		},
	};
};

// Mirrors easy_pos.api.sync.INVOICE_FIELDS so a just-synced invoice shows up
// immediately in the offline-browsable Invoices list (engine/localReads.js's
// readInvoiceList) without waiting for the next full runFullSync.
const upsertInvoiceCache = async (doc) => {
	await db.invoices.put({
		name: doc.name,
		posting_date: doc.posting_date,
		customer: doc.customer,
		customer_name: doc.customer_name,
		grand_total: doc.grand_total,
		status: doc.status,
		docstatus: doc.docstatus,
		pos_profile: doc.pos_profile,
		is_pos: doc.is_pos,
	});
};

// Pushes a single queued row. Called directly (not via engineCall/enginePost)
// because this must always go to the server, never be routed back to the
// local DB — same reasoning as connectivity.js's heartbeat bypassing the engine.
const pushOne = async (row) => {
	await db.pending_invoices.update(row.offline_id, {
		status: "syncing",
		updated_at: new Date().toISOString(),
	});
	try {
		const { invoice, opening_details, coupon_code } = row.payload;
		// Self-heals any row that was queued before sanitizeInvoicePayload
		// existed (or otherwise slipped through with a stale offline
		// display_id in sales_invoice) — pushing must never send one to the
		// backend regardless of how it ended up in the stored payload.
		const response = await axios.post(PUSH_URL, {
			offline_id: row.offline_id,
			invoice: sanitizeInvoicePayload(invoice),
			opening_details,
			submit: row.submit,
			coupon_code,
		});
		const doc = response.data.message;
		await db.pending_invoices.update(row.offline_id, {
			status: "synced",
			erpnext_name: doc.name,
			error: null,
			updated_at: new Date().toISOString(),
		});
		await upsertInvoiceCache(doc);
		return { ok: true, offline_id: row.offline_id, name: doc.name };
	} catch (err) {
		const message = extractErrorMessage(err);
		await db.pending_invoices.update(row.offline_id, {
			status: "failed",
			error: message,
			attempts: (row.attempts || 0) + 1,
			updated_at: new Date().toISOString(),
		});
		return { ok: false, offline_id: row.offline_id, error: message };
	}
};

// Guards against overlapping passes (a reconnect heartbeat and the Sync
// page's manual "Push now" firing close together) — only one drain of the
// queue runs at a time; a second caller just awaits the same in-flight pass.
let pushInFlight = null;

// Drains every "queued" row, oldest first (preserves the order sales were
// actually rung up in — matters for stock deduction correctness), pushing
// sequentially rather than in parallel for the same reason. Deliberately does
// NOT include "failed" rows — those wait for an explicit retryOfflineInvoice
// call so a bad invoice doesn't loop forever on every reconnect.
export const pushPendingInvoices = async () => {
	if (pushInFlight) return pushInFlight;

	pushInFlight = (async () => {
		const queued = await db.pending_invoices
			.where("status")
			.equals("queued")
			.sortBy("created_at");
		const results = [];
		for (const row of queued) {
			results.push(await pushOne(row));
		}
		return results;
	})();

	try {
		return await pushInFlight;
	} finally {
		pushInFlight = null;
	}
};

// Manual retry for a single "failed" row (Sync page's per-row Retry button).
export const retryOfflineInvoice = async (offline_id) => {
	const row = await db.pending_invoices.get(offline_id);
	if (!row) return null;
	return pushOne(row);
};

export const getPendingInvoices = () =>
	db.pending_invoices.orderBy("created_at").reverse().toArray();

export const getPendingInvoiceCount = () =>
	db.pending_invoices.where("status").anyOf(["queued", "syncing", "failed"]).count();
