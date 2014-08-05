/** @jsx React.DOM */

define(['jquery', 'backbone', 'underscore', 'react',],
	function ($, Backbone, _, React) {

	var FlashDiv = React.createClass({displayName: 'FlashDiv',
		getInitialState: function () {
			return {message:'', action:''};
		},
		message: function (text, className, wait) {
			var wp = this.refs.message.getDOMNode();
			$(wp).fadeOut(function () {
				function removeAfterWait() {
					setTimeout(function () {
						$(this).fadeOut();
					}.bind(this), wait || 5000);
				}
				$(this.refs.messageContent.getDOMNode()).html(text);
				$(wp).prop('class', 'message '+className).fadeIn('fast', removeAfterWait);
			}.bind(this)); 
		},
		hide: function () {
			$(this.refs.message.getDOMNode()).fadeOut();
		},
		render: function () {
			return (
				React.DOM.div( {ref:"message", className:"message", style:{ 'display': 'none' }, onClick:this.hide}, 
					React.DOM.span( {ref:"messageContent"}), " ", React.DOM.i( {className:"close-btn", onClick:this.hide})
				)
			);
		},
	});

	return (function FlashNotifier (message, className, wait) {
		this.fd = React.renderComponent(FlashDiv(null ), $('<div id=\'flash-wrapper\'>').appendTo('body')[0]);
		this.warn = function (message, wait) {
			this.fd.message(message, 'warn', wait);
		}
		this.info = function (message, wait) {
			this.fd.message(message, 'info', wait);
		}
		this.alert = function (message, wait) {
			this.fd.message(message, 'error', wait);			
		}
	});
});

