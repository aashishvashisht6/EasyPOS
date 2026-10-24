import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import flt, now
from frappe.utils.password import check_password

CASH_MANAGER_ROLE = "POS Cash Manager"


def _is_cash_manager(user: str) -> bool:
	return CASH_MANAGER_ROLE in frappe.get_roles(user)


def _get_open_shift(opening_entry: str):
	shift = frappe.get_doc("EP Opening Entry", opening_entry)
	if shift.docstatus != 1 or shift.ep_closing_entry:
		frappe.throw(_("Shift {0} is not open").format(opening_entry))
	# A cashier records movements against their own shift; a cash manager can
	# record against anyone's (e.g. a drop pulled from another register).
	if shift.user != frappe.session.user and not _is_cash_manager(frappe.session.user):
		frappe.throw(_("You can only record cash movements for your own shift"), frappe.PermissionError)
	return shift


def _cash_modes(pos_profile: str) -> list[str]:
	"""The profile's payment modes whose Mode of Payment type is Cash, in the
	profile's own order — a cash movement only ever moves physical cash."""
	PaymentMethod = frappe.qb.DocType("POS Payment Method")
	ModeOfPayment = frappe.qb.DocType("Mode of Payment")
	rows = (
		frappe.qb.from_(PaymentMethod)
		.join(ModeOfPayment)
		.on(ModeOfPayment.name == PaymentMethod.mode_of_payment)
		.select(PaymentMethod.mode_of_payment)
		.where((PaymentMethod.parent == pos_profile) & (PaymentMethod.parenttype == "POS Profile") & (ModeOfPayment.field("type") == "Cash"))
		.orderby(PaymentMethod.idx)
	).run(as_dict=True)
	return [row.mode_of_payment for row in rows]


@frappe.whitelist()
def get_cash_movements(opening_entry: str) -> dict:
	"""This shift's submitted cash movements, the cash modes a movement can use,
	and whether the current user can record one without a manager's approval."""
	shift = _get_open_shift(opening_entry)
	movements = frappe.get_all(
		"EP Cash Movement",
		filters={"opening_entry": opening_entry, "docstatus": 1},
		fields=[
			"name",
			"movement_type",
			"mode_of_payment",
			"amount",
			"reason",
			"posting_datetime",
			"user",
			"approved_by",
		],
		order_by="posting_datetime desc",
	)
	return {
		"movements": movements,
		"cash_modes": _cash_modes(shift.pos_profile),
		"can_record": _is_cash_manager(frappe.session.user),
	}


# Rate-limited because a cashier without the role passes a manager's password
# here — caps password guessing from a till to a handful of attempts.
@frappe.whitelist(methods=["POST"])
@rate_limit(limit=10, seconds=5 * 60)
def create_cash_movement(
	opening_entry: str,
	movement_type: str,
	mode_of_payment: str,
	amount: float,
	reason: str,
	approver: str | None = None,
	approver_password: str | None = None,
) -> dict:
	shift = _get_open_shift(opening_entry)

	if movement_type not in ("Cash In", "Cash Out"):
		frappe.throw(_("Movement type must be Cash In or Cash Out"))
	if not (reason or "").strip():
		frappe.throw(_("Please enter a reason"))
	if mode_of_payment not in _cash_modes(shift.pos_profile):
		frappe.throw(_("{0} is not a cash payment mode of this POS Profile").format(mode_of_payment))

	if _is_cash_manager(frappe.session.user):
		approved_by = frappe.session.user
	else:
		approved_by = _verify_approver(approver, approver_password)

	movement = frappe.get_doc(
		{
			"doctype": "EP Cash Movement",
			"opening_entry": shift.name,
			"movement_type": movement_type,
			"mode_of_payment": mode_of_payment,
			"amount": flt(amount),
			"reason": reason.strip(),
			"posting_datetime": now(),
			"user": frappe.session.user,
			"approved_by": approved_by,
		}
	)
	# The approval above is the gate: the cashier usually lacks EP Cash
	# Movement's create permission (only POS Cash Manager / System Manager
	# have it), which is exactly why the manager's credentials were checked.
	movement.insert(ignore_permissions=True)
	movement.submit()
	return movement.as_dict()


def _verify_approver(approver: str | None, approver_password: str | None) -> str:
	if not approver or not approver_password:
		frappe.throw(_("A POS Cash Manager must approve this cash movement"), frappe.PermissionError)

	user = frappe.db.get_value(
		"User", {"name": approver}, ["name", "enabled"], as_dict=True
	) or frappe.db.get_value("User", {"email": approver}, ["name", "enabled"], as_dict=True)
	# Same message for an unknown user, a wrong password, and a user without the
	# role, so the prompt can't be used to discover which usernames exist.
	invalid = _("Manager approval failed — check the username and password")
	if not user or not user.enabled:
		frappe.throw(invalid, frappe.AuthenticationError)
	try:
		check_password(user.name, approver_password)
	except frappe.AuthenticationError:
		frappe.throw(invalid, frappe.AuthenticationError)
	if not _is_cash_manager(user.name):
		frappe.throw(invalid, frappe.AuthenticationError)
	return user.name
