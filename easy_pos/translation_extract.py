from frappe.gettext.extractors.javascript import extract_javascript

# POS frontend translation functions (posapp/src/translation/index.js): `__` for
# strings translated at render time, `_t` for module-level constants marked
# for extraction and translated later.
POS_KEYWORDS = ("__", "_t")


def extract(fileobj, keywords, comment_tags, options):
	"""Babel extractor for posapp's .js/.jsx sources (wired up in
	babel_extractors.csv). Same as frappe.gettext.extractors.javascript.extract,
	which already tokenizes JSX, but also recognizes `_t`."""
	code = fileobj.read().decode("utf-8")

	for lineno, _funcname, messages in extract_javascript(code, keywords=POS_KEYWORDS, options=options):
		if not messages or not messages[0]:
			continue

		funcname = "gettext"
		if isinstance(messages, tuple):
			if len(messages) == 3 and messages[2]:
				funcname = "pgettext"
				messages = (messages[2], messages[0])
			else:
				messages = messages[0]

		yield lineno, funcname, messages, []
