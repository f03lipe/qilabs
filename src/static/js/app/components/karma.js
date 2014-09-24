/** @jsx React.DOM */

var $ = require('jquery')
var _ = require('lodash')
var React = require('react')
var bootstrap_tooltip = require('bootstrap.tooltip')
var bootstrap_popover = require('bootstrap.popover')
var Favico = require('favico')
window.Favico = Favico;

try {
	var favico = new Favico({
	    animation:'slide'
	});
} catch (e) {
	console.warn("Failed to initialize favico", e);
}

$.extend($.fn.popover.Constructor.DEFAULTS, {react: false});
var oldSetContent = $.fn.popover.Constructor.prototype.setContent;
$.fn.popover.Constructor.prototype.setContent = function() {
	if (!this.options.react) {
		return oldSetContent.call(this);
	}
	var $tip = this.tip();
	var title = this.getTitle();
	var content = this.getContent();
	$tip.removeClass('fade top bottom left right in');
	if (!$tip.find('.popover-content').html()) {
		var $title = $tip.find('.popover-title');
		if (title) {
			React.renderComponent(title, $title[0]);
		} else {
			$title.hide();
		}
		React.renderComponent(content, $tip.find('.popover-content')[0]);
	}
};

var KarmaTemplates = {
	PostUpvote: function (item) {
		if (item.instances.length === 1) {
			var name = item.instances[0].name.split(' ')[0];
			// return name+" votou na sua publicação '"+item.name+"'"
			return name+" votou"
		} else {
			var names = _.map(item.instances.slice(0, item.instances.length-1),
				function (i) {
					return i.name.split(' ')[0];
				}).join(', ')
			names += " e "+(item.instances[item.instances.length-1].name.split(' '))[0]+" ";
			return names+" votaram";
		}
	}
}

if (window.user) {

	var Points = {
		'PostUpvote': 5
	};

	var KarmaItem = React.createClass({displayName: 'KarmaItem',
		handleClick: function () {
			if (this.props.data.path) {
				window.location.href = this.props.data.path;
			}
		},
		render: function () {
			// var thumbnailStyle = {
			// 	backgroundImage: 'url('+this.props.data.thumbnailUrl+')',
			// };
			// <span dangerouslySetInnerHTML={{__html: message}} />
			// {this.props.data.thumbnailUrl?
			// <div className="thumbnail" style={thumbnailStyle}></div>:undefined}
			// }

			var ptype = this.props.data.object.postType;
			if (ptype) {
				var icon = (
					React.DOM.i( {className:ptype=='Note'?"icon-file-text":"icon-chat3"})
				);
			}

			var date = window.calcTimeFrom(this.props.data.last_update);
			var message = KarmaTemplates[this.props.data.type](this.props.data)
			console.log(Points, this.props.data.type, this.props.data.multiplier)
			var delta = Points[this.props.data.type]*this.props.data.multiplier;
			return (
				React.DOM.li( {'data-seen':this.props.seen, onClick:this.handleClick}, 
					React.DOM.div( {className:"left"}, 
						React.DOM.div( {className:"delta"}, 
							"+",delta
						)
					),
					React.DOM.div( {className:"right body"}, 
						React.DOM.span( {className:"name"}, icon, " ", this.props.data.object.name),
						React.DOM.span( {className:"read"}, message)
					)
				)
			);
						// <time>{date}</time>
		},
	});

	var KarmaPopoverList = React.createClass({displayName: 'KarmaPopoverList',
		render: function () {
			var items = this.props.data.items.map(function (i) {
				return (
					KarmaItem( {key:i.id, data:i} )
				);
			}.bind(this));
			return (
				React.DOM.div( {className:"popover-inner"}, 
					React.DOM.div( {className:"top"}, 
						"Karma ", React.DOM.div( {className:"detail"}, "+",window.user.karma)
					),
					React.DOM.div( {className:"popover-list"}, 
						items
					)
				)
			);
		}
	});

	var KarmaList = React.createClass({displayName: 'KarmaList',
		getInitialState: function () {
			return { seen_all: true }
		},
		componentWillMount: function () {
			var self = this;
			// Hide popover when mouse-click happens outside it.
			$(document).mouseup(function (e) {
				var container = $(self.refs.button.getDOMNode());
				if (!container.is(e.target) && container.has(e.target).length === 0
					&& $(e.target).parents('.popover.in').length === 0) {
					$(self.refs.button.getDOMNode()).popover('hide');
				}
			});
		},
		getKarma: function () {
		},
		onClick: function () {

			if (!this.fetchedData) {
				this.fetchedData = true;
				var self = this;
				$.ajax({
					url: '/api/me/karma',
					type: 'get',
					dataType: 'json',
				}).done(function (response) {
					if (response.error) {
						app.flash && app.flash.warn(response.error);
						return;
					}
					console.log("PORRA")
					var destroyPopover = function () {
						$(this.refs.button.getDOMNode()).popover('destroy');
					}.bind(this);
					$button = $(this.refs.button.getDOMNode()).popover({
						react: true,
						content: KarmaPopoverList( {data:response.data, destroy:destroyPopover}),
						placement: 'bottom',
						// container: 'nav.bar',
						container: 'body',
						trigger: 'manual'
					});
					if ($button.data('bs.popover') &&
						$button.data('bs.popover').tip().hasClass('in')) { // already visible
						console.log("NOT")
						$button.popover('hide');
					} else {
						$button.popover('show');
					}
				}.bind(this));
			} else {
				var $button = $(this.refs.button.getDOMNode());
				$button.popover('show');
			}
		},
		render: function () {
			return (
				React.DOM.button(
					{ref:"button",
					className:"icon-btn karma "+(this.state.seen_all?"":"active"),
					'data-action':"show-karma",
					onClick:this.onClick}, 
					React.DOM.i( {className:"icon-lightbulb2"}),
					React.DOM.sup( {ref:"nCount", className:"count"}, window.user.karma)
				)
			);
		},
	});

	if (document.getElementById('nav-karma'))
		React.renderComponent(KarmaList(null ),
			document.getElementById('nav-karma'));
}