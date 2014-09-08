
/*
** common.js
** Copyright QILabs.org
** BSD License
*/

// Present in all built javascript.

window.calcTimeFrom = function (arg, short) {
	var now = new Date(),
		then = new Date(arg),
		diff = now-then;

	if (diff < 1000*60) {
		return 'agora';
	} else if (diff < 1000*60*60) {
		var m = Math.floor(diff/1000/60);
		return short?'há '+m+'m':'há '+m+' minuto'+(m>1?'s':'');
	} else if (diff < 1000*60*60*30) { // até 30 horas
		var m = Math.floor(diff/1000/60/60);
		return short?'há '+m+'h':'há '+m+' hora'+(m>1?'s':'');
	} else if (diff < 1000*60*60*24*14) {
		var m = Math.floor(diff/1000/60/60/24);
		return short?'há '+m+'d':'há '+m+' dia'+(m>1?'s':'');
	} else {
		var m = Math.floor(diff/1000/60/60/24/7);
		return short?'há '+m+'sem':'há '+m+' semana'+(m>1?'s':'');
	}
};

var $ = require('jquery')
var modernizr = require('modernizr')
var plugins = require('./plugins.js')
var bootstrap_tooltip = require('../vendor/bootstrap/tooltip.js')
var bootstrap_button = require('../vendor/bootstrap/button.js')
var bootstrap_dropdown = require('../vendor/bootstrap/dropdown.js')
var bell = require('./components/bell.js')

$("body").tooltip({selector:'[data-toggle=tooltip]'});
$("[data-toggle=dialog]").xdialog();
$('.btn').button();

(function setCSRFToken () {
	$.ajaxPrefilter(function(options, _, xhr) {
		if (!options.crossDomain) {
			xhr.setRequestHeader('X-CSRF-Token',
				$("meta[name='csrf-token']").attr('content'));
		}
	});
})();

// Part of a snpage-only functionality
// Hide popover when mouse-click happens outside of it.
$(document).mouseup(function (e) {
	var container = $('#sidebarPanel');
	if ($('body').hasClass('sidebarOpen')) {
		if (!container.is(e.target) && container.has(e.target).length === 0 && 
			!$('#openSidebar').is(e.target) && $('#openSidebar').has(e.target).length === 0) {
			$('body').removeClass('sidebarOpen');
		}
	}
});
// $(document).keydown(function(e){
// 	if (e.keyCode == 32) {
// 		$('body').toggleClass('sidebarOpen');
// 		return false;
// 	}
// });
$(document).on('click', '#openSidebar', function (e) {
	$('body').toggleClass('sidebarOpen');
});

$('body').on("click", ".btn-follow", function (evt) {
	var action = this.dataset.action;
	if (action !== 'follow' && action !== 'unfollow')
		throw "What?";

	var neew = (action==='follow')?'unfollow':'follow';
	if (this.dataset.user) {
		$.post('/api/users/'+this.dataset.user+'/'+action, function (data) {
			if (data.error) {
				alert(data.error);
			} else {
				this.dataset.action = neew;
			}
		}.bind(this));
	}
});

$('body').on('click', '[data-trigger=component]', function (e) {
	e.preventDefault();
	// Call router method
	var dataset = this.dataset;
	// Too coupled. This should be implemented as callback, or smthng. Perhaps triggered on navigation.
	$('body').removeClass('sidebarOpen');
	if (dataset.route) {
		var href = $(this).data('href') || $(this).attr('href');
		if (href)
			console.warn('Component href attribute is set to '+href+'.');
		app.navigate(href, {trigger:true, replace:false});
	} else {
		if (typeof app === 'undefined' || !app.components) {
			if (dataset.href)
				window.location.href = dataset.href;
			else
				console.error("Can't trigger component "+app.page+" in unexistent app object.");
			return;
		}
		if (dataset.component in app.components) {
			var data = {};
			if (dataset.args) {
				try {
					data = JSON.parse(dataset.args);
				} catch (e) {
					console.error('Failed to parse data-args '+dataset.args+' as JSON object.');
					console.error(e.stack);
				}
			}
			app.components[dataset.component].call(app, data);
		} else {
			console.warn('Router doesn\'t contain component '+dataset.component+'.')
		}
	}
});

// GOSTAVA TANTO DE NUTELLA
	
$("a[data-ajax-post-href],button[data-ajax-post-href]").click(function () {
	var href = this.dataset['ajaxPostHref'],
		redirect = this.dataset['redirectHref'];
	$.post(href, function () {
		if (redirect)
			window.location.href = redirect;
		else
			window.location.reload();
	});
});