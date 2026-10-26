from functools import lru_cache

import frappe
from babel.messages.pofile import read_po
from frappe.gettext.translate import get_pot_path
from frappe.translate import get_all_languages, get_all_translations

# Sent by the POS frontend on every request (posapp/src/api/config.js) with the
# language chosen on that device (posapp/src/store/languageStore.js).
LANGUAGE_HEADER = "X-Easy-POS-Language"

# Master-data doctypes whose record *names* show up as labels in the POS
# (payment rows, category chips, filters). Their names are resolved through
# Frappe's own translations, so ERPNext's shipped ones (e.g. "Cash") work out
# of the box and anything else can be added as a Translation record in desk.
NAME_DOCTYPES = ("Mode of Payment", "Item Group", "Customer Group", "Territory", "Item Attribute")


def _supported(language: str | None) -> str | None:
	"""Frappe's own Language name for `language`, matched case-insensitively
	("pt-br" -> "pt-BR"), or None if Frappe doesn't know it."""
	language = (language or "").strip().lower()
	if not language:
		return None
	return next((name for name in get_all_languages() if name.lower() == language), None)


def apply_request_language() -> None:
	"""before_request hook: makes frappe.throw/_() messages come back in the
	language the cashier picked on this device, rather than only ever in the
	Frappe User's own language setting. A header (not a `_lang` form param) so
	it never reaches whitelisted methods that accept **kwargs."""
	language = _supported(frappe.get_request_header(LANGUAGE_HEADER))
	if language:
		frappe.local.lang = language


@lru_cache
def _pos_message_ids() -> frozenset[str] | None:
	"""Translation keys for every string easy_pos uses — msgids (and
	"msgid:context" keys) from easy_pos/locale/main.pot, which
	`bench generate-pot-file --app easy_pos` extracts from the posapp sources
	(see babel_extractors.csv) as well as this app's Python/DocTypes. Read once
	per worker; the POT only changes with a deploy. None when it's missing."""
	pot_path = get_pot_path("easy_pos")
	if not pot_path.exists():
		return None

	with open(pot_path, "rb") as f:  # nosemgrep: frappe-security-file-traversal
		catalog = read_po(f)

	return frozenset(
		f"{message.id}:{message.context}" if message.context else message.id
		for message in catalog
		if message.id
	)


@frappe.whitelist(allow_guest=True)  # nosemgrep: guest-whitelisted-method
def get_pos_translations(lang: str) -> dict:
	"""{source: translated} the POS frontend needs in `lang`, straight from
	Frappe's own translation system (frappe.translate.get_all_translations:
	every installed app's .po/.mo files plus Translation records), so POS
	strings already translated by Frappe/ERPNext need no extra work.

	Only the keys easy_pos uses are returned — the full dictionary is several
	MB. Allowed for Guest so the login screen is translated; record values
	(item names, payment modes...) are added only for a logged-in session."""
	lang = _supported(lang)
	if not lang or lang == "en":
		return {}

	all_translations = get_all_translations(lang)
	message_ids = _pos_message_ids()
	if message_ids is None:
		translations = dict(all_translations)
	else:
		translations = {key: all_translations[key] for key in message_ids if key in all_translations}

	if frappe.session.user != "Guest":
		translations.update(_get_data_translations(lang, all_translations))

	return translations


def _get_data_translations(language: str, app_translations: dict) -> dict:
	"""{source: translated} for data values the POS displays (item names,
	payment modes, item groups, attribute values...):

	- every Translation record for that language — the desk-managed way to
	  translate any record value (Item names, Warehouse names, ...), and
	- the names of NAME_DOCTYPES records that Frappe/ERPNext's own app
	  translations already cover."""
	translations = {
		row.source_text: row.translated_text
		for row in frappe.get_all(
			"Translation",
			filters={"language": language},
			fields=["source_text", "translated_text"],
		)
		if row.source_text and row.translated_text
	}

	names = set()
	for doctype in NAME_DOCTYPES:
		names.update(frappe.get_all(doctype, pluck="name"))
	names.update(frappe.get_all("Item Attribute Value", pluck="attribute_value", distinct=True))
	for name in names:
		if name and name not in translations and app_translations.get(name):
			translations[name] = app_translations[name]

	return translations
