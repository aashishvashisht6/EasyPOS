import frappe
from frappe import _
from frappe.utils import flt, nowdate

# Fallback when neither the Currency doc nor System Settings has one — same
# default Frappe itself ships with.
DEFAULT_NUMBER_FORMAT = "#,###.##"


def _exchange_rate(from_currency: str, to_currency: str, transaction_date: str | None = None) -> float:
	"""from_currency -> to_currency rate via ERPNext's own resolver (Currency Exchange
	records first, then the provider configured in Currency Exchange Settings) — the
	same lookup desk's Sales Invoice form does when its currency changes."""
	if not from_currency or not to_currency or from_currency == to_currency:
		return 1.0

	from erpnext.setup.utils import get_exchange_rate

	rate = flt(get_exchange_rate(from_currency, to_currency, transaction_date or nowdate(), "for_selling"))
	if not rate:
		# get_exchange_rate returns 0 (rather than raising) when nothing resolves —
		# silently selling at a 0/1 rate would post wrong ledger amounts, so fail loudly.
		frappe.throw(
			_(
				"No exchange rate found from {0} to {1}. Create a Currency Exchange record (For Selling) for this pair."
			).format(from_currency, to_currency),
			title=_("Missing Exchange Rate"),
		)
	return rate


def get_company_currency(company: str) -> str:
	return frappe.get_cached_value("Company", company, "default_currency")


def get_profile_currency(pos_profile: str) -> str:
	"""Currency a POS Profile's invoices are raised in — the profile's own `currency`,
	else its selling Price List's, else the Company's (ERPNext's own defaulting order)."""
	profile = frappe.get_cached_doc("POS Profile", pos_profile)
	price_list_currency = (
		frappe.get_cached_value("Price List", profile.selling_price_list, "currency")
		if profile.selling_price_list
		else None
	)
	return profile.currency or price_list_currency or get_company_currency(profile.company)


def get_profile_currency_context(pos_profile: str, transaction_date: str | None = None) -> frappe._dict:
	"""Everything a Sales Invoice under this POS Profile needs to be correct when the
	profile's currency and/or its Price List's currency differ from the Company's:

	- conversion_rate: invoice currency -> company currency
	- plc_conversion_rate: price list currency -> company currency

	Both are 1 for a single-currency shop, so this is a no-op there."""
	profile = frappe.get_cached_doc("POS Profile", pos_profile)
	company_currency = get_company_currency(profile.company)
	currency = get_profile_currency(pos_profile)
	price_list_currency = (
		frappe.get_cached_value("Price List", profile.selling_price_list, "currency")
		if profile.selling_price_list
		else None
	) or currency

	return frappe._dict(
		currency=currency,
		company_currency=company_currency,
		price_list_currency=price_list_currency,
		conversion_rate=_exchange_rate(currency, company_currency, transaction_date),
		plc_conversion_rate=_exchange_rate(price_list_currency, company_currency, transaction_date),
	)


def get_rate_factors(pos_profile: str | None) -> tuple[float, float]:
	"""(price_list_factor, company_factor) multipliers that turn an Item Price rate
	(price list currency) and an Item.standard_rate (company currency) into the
	profile's invoice currency — what ERPNext's get_item_details does internally
	with plc_conversion_rate/conversion_rate. (1, 1) without a profile."""
	if not pos_profile:
		return 1.0, 1.0
	ctx = get_profile_currency_context(pos_profile)
	return ctx.plc_conversion_rate / ctx.conversion_rate, 1 / ctx.conversion_rate


def _currency_format(currency: str) -> dict:
	row = (
		frappe.get_cached_value(
			"Currency", currency, ["symbol", "number_format", "symbol_on_right"], as_dict=True
		)
		or frappe._dict()
	)
	return {
		"currency": currency,
		"symbol": row.get("symbol") or currency,
		"number_format": row.get("number_format")
		or frappe.db.get_default("number_format")
		or DEFAULT_NUMBER_FORMAT,
		"symbol_on_right": bool(row.get("symbol_on_right")),
	}


@frappe.whitelist()
def get_currency_formats(currencies: list | str) -> dict:
	"""Display format (symbol, digit grouping, symbol position) per currency, for
	pages listing documents that may be in a currency other than the open shift's
	(Invoices list, invoice detail, drafts)."""
	if isinstance(currencies, str):
		currencies = frappe.parse_json(currencies)
	return {currency: _currency_format(currency) for currency in set(currencies or []) if currency}


@frappe.whitelist()
def get_currency_context(pos_profile: str) -> dict:
	"""Fetched once per shift (posSessionStore.loadProfileDetails): the profile's
	invoice currency, its display format, and the exchange rate to the Company's
	currency — throws (via _exchange_rate) if that rate can't be resolved, so a
	misconfigured multi-currency profile is caught at shift open, not mid-sale."""
	ctx = get_profile_currency_context(pos_profile)
	return {
		**ctx,
		**_currency_format(ctx.currency),
		"multi_currency_party_warning": needs_multi_currency_party_setting(ctx),
	}


def needs_multi_currency_party_setting(ctx) -> bool:
	"""True when this profile sells in a currency other than the Company's while
	Accounts Settings' "Allow multi-currency invoices against single party
	account" is off. ERPNext (AccountsController.validate_party_account_currency)
	then rejects the first sale to any customer who has no ledger entries yet,
	because the Debtors account is in the Company's currency."""
	return ctx.currency != ctx.company_currency and not frappe.db.get_single_value(
		"Accounts Settings", "allow_multi_currency_invoices_against_single_party_account"
	)
