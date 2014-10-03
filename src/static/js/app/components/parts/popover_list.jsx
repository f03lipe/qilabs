/** @jsx React.DOM */

var React = require('react')
var $ = require('jquery')
var bootstrap_popover = require('bootstrap.popover')

/**
 * Extend bootstrap's popover to accept React components as their content.
 */

$.extend($.fn.popover.Constructor.DEFAULTS, {react: false})
var oldSetContent = $.fn.popover.Constructor.prototype.setContent

$.fn.popover.Constructor.prototype.setContent = function() {
	if (!this.options.react) {
		return oldSetContent.call(this)
	}
	var $tip = this.tip()
	var title = this.getTitle()
	var content = this.getContent()
	$tip.removeClass('fade top bottom left right in')
	if (!$tip.find('.popover-content').html()) {
		var $title = $tip.find('.popover-title')
		if (title) {
			React.renderComponent(title, $title[0])
		} else {
			$title.hide()
		}
		React.renderComponent(content, $tip.find('.popover-content')[0])
	}
}

/**
 * React component for the list of items in the popover.
 */

var List = React.createClass({
	componentWillMount: function () {
		this.props.collection.on('add reset update change', function () {
			this.forceUpdate()
		}.bind(this))
	},
	render: function () {
		if (this.props.collection.models.length === 0) {
			return (
				<div className="popover-inner">
					<span dangerouslySetInnerHTML={{__html: this.props.messageEmpty }}>
					</span>
				</div>
			)
		}
		var items = this.props.collection.map(function (i) {
			return this.props.itemComponent({ key: i.cid, model: i })
		}.bind(this))
		return (
			<div className="popover-inner popover-list notification-list">
				{items}
			</div>
		)
	}
})

/**
 * ... main function?
 */

module.exports = function (el, collection, c, data) {
	$(el).popover({
		react: true,
		content: List({
			itemComponent: c,
			collection: collection,
			destroy: function () {
				$(el).popover('destroy')
			},
			messageEmpty: "<div class='msg-empty'>Nada aqui por enquanto.</div>"
		}),
		placement: 'bottom',
		container: 'body',
		trigger: 'manual',
	})

	data.className && $($(el).data('bs.popover').tip()).addClass(data.className)

	// Hide popover when mouse-click happens outside of popover/button.
	$(document).mouseup(function (e) {
		var button = $(el)
		if (!button.is(e.target) && // button isn't target
	 		button.has(e.target).length === 0 && // button isn't target parent
			$(e.target).parents('.popover.in').length === 0) { // target isn't inside popover
			$(el).popover('hide')
		}
	}.bind(this))

	$(el).click(function (evt) {
		var $el = $(el)
		if ($el.data('bs.popover') && $el.data('bs.popover').tip().hasClass('in')) {
			$el.popover('hide')
		} else {
			$el.popover('show')
		}
		data.onClick && data.onClick(evt)
	})
}