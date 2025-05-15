frappe.pages['easy-pos'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Easy POS',
		single_column: true
	});
	
	$('div.navbar-fixed-top').find('.container').css('padding', '0');
	$(document).find('#body').html('<div id="easy-pos-app"></div>')

	frappe.require('easypos.bundle.js', () => {
		// Vue app mounted from here
	});
};


