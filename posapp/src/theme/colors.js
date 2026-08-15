export const colors = {
	primary: "#f59e0b",
	primaryHover: "#d98708",
	onPrimary: "#10141c",

	darkSurface: "#10141c",
	darkText: "#f6f7fb",
	darkTextMuted: "#9aa1b2",
	darkTextDim: "#c7cbd6",
	darkTextFaint: "#5b6172",

	bg: "#f6f7fb",
	surface: "#ffffff",
	surfaceAlt: "#fafbfc",

	border: "#e2e5ec",
	borderSoft: "#e8eaef",
	borderFaint: "#f1f2f5",
	borderInput: "#d8dbe3",

	textPrimary: "#111827",
	textSecondary: "#374151",
	textMuted: "#6b7280",
	textFaint: "#9ca3af",

	success: { bg: "#eafbf1", text: "#15803d", icon: "#16a34a" },
	warning: { bg: "#fef9e7", bgSoft: "#fdf3e2", text: "#92610a", textStrong: "#b45309" },
	danger: { bg: "#fef2f2", bgSoft: "#fef8f8", text: "#b91c1c", icon: "#dc2626" },

	avatarBg: "#374151",
	avatarText: "#e2e5ec",
};

/**
 * Maps a POS/invoice status string to the badge class + semantic color set.
 * Keeps status→color mapping in one place instead of scattered per component.
 */
export const statusColorMap = {
	paid: { className: "pos-badge-paid", ...colors.success },
	synced: { className: "pos-badge-success", ...colors.success },
	unpaid: { className: "pos-badge-unpaid", ...colors.warning },
	overdue: { className: "pos-badge-overdue", ...colors.danger },
	conflict: { className: "pos-badge-overdue", ...colors.danger },
};

export function getStatusBadgeClass(status) {
	return statusColorMap[status?.toLowerCase()]?.className ?? "pos-badge";
}
