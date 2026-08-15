// Copyright (c) 2026, Aashish and contributors
// For license information, please see license.txt

frappe.ui.form.on("EASYPOS Settings", {
	refresh(frm) {
		frm.add_custom_button(__("Create Demo Data"), () => {
			const dialog = new frappe.ui.Dialog({
				title: __("Create Demo Data"),
				fields: [
					{
						fieldname: "company",
						fieldtype: "Link",
						options: "Company",
						label: __("Company"),
						reqd: 1,
						default: frappe.defaults.get_default("company"),
						description: __(
							"Demo items (normal, serialized, batch-tracked, and a combo) with selling prices and opening stock, 5 POS Profiles showing off different features, and 5 demo Customers will be created for this company (a default warehouse is created too if it doesn't already have one)."
						),
					},
				],
				primary_action_label: __("Create"),
				primary_action(values) {
					dialog.hide();
					frappe.call({
						method: "easy_pos.easy_pos.doctype.easypos_settings.easypos_settings.create_demo_data",
						args: { company: values.company },
						freeze: true,
						freeze_message: __("Creating demo items..."),
						callback(r) {
							if (!r.message) return;
							frappe.msgprint({
								title: __("Demo Data Created"),
								indicator: "green",
								message: __(
									"Created/updated {0} demo items priced against {1} for {2} (warehouse: {3}), {4} POS Profiles: {5}, and {6} Customers: {7}.",
									[
										r.message.items,
										r.message.price_list,
										r.message.company,
										r.message.warehouse,
										r.message.profiles.length,
										r.message.profiles.join(", "),
										r.message.customers.length,
										r.message.customers.join(", "),
									]
								),
							});
						},
					});
				},
			});
			dialog.show();
		});
	},
});
