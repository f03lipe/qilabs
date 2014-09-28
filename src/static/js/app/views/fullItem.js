/** @jsx React.DOM */

var React = require('react')
var PostVIew = require('./postView.js')
var ProblemView = require('./problemView.js')

module.exports = React.createClass({displayName: 'exports',
	componentWillMount: function () {
		var update = function () {
			this.forceUpdate(function(){});
		}
		this.props.model.on('add reset remove change', update.bind(this));
	},

	close: function () {
		this.props.page.destroy();
	},

	onClickEdit: function () {
		// console.log('clicked')
		// this.props.page.destroy(true);
		// var url = this.props.model.get('path')+'/editar';
		// setTimeout(function () {
		// 	console.log('done')
		// 	app.navigate(url, { trigger: true, change: true });
		// },1);

		// Fuck this shit, this is too complicated.
		// This is necessary for problems (as opposed to just app.navigating to the edit
		// url) because some fields may only be loaded through an ajax call. OK-design?
		window.location.href = this.props.model.get('path')+'/editar';
	},

	onClickTrash: function () {
		if (confirm('Tem certeza que deseja excluir essa postagem?')) {
			this.props.model.destroy();
			this.close();
			// Signal to the wall that the post with this ID must be removed.
			// This isn't automatic (as in deleting comments) because the models on
			// the wall aren't the same as those on post FullPostView.
			console.log('id being removed:',this.props.model.get('id'))
			app.postList.remove({id:this.props.model.get('id')})
			$('.tooltip').remove(); // fuckin bug
		}
	},

	toggleVote: function () {
		this.props.model.handleToggleVote();
	},

	componentDidMount: function () {
		// Close when user clicks directly on element (meaning the faded black background)
		var self = this;
		$(this.getDOMNode().parentElement).on('click', function onClickOut (e) {
			if (e.target === this || e.target === self.getDOMNode()) {
				self.close();
				$(this).unbind('click', onClickOut);
			}
		});
	},

	render: function () {
		var post = this.props.model.attributes,
			author = this.props.model.get('author'),
			type = this.props.type;
		if (type === "Note" || type === "Discussion") {
			var postView = PostVIew;
		} else if (type === "Problem") {
			var postView = ProblemView;
		} else {
			console.error('Couldn\'t find view for post of type '+type, post);
			return React.DOM.div(null);
		}

		return (
			React.DOM.div( {className:"qi-box postBox", 'data-post-type':this.props.model.get('type'), 'data-post-id':this.props.model.get('id')}, 
				React.DOM.i( {className:"close-btn", 'data-action':"close-page", onClick:this.close}),
				postView( {model:this.props.model, parent:this} )
			)
		);
	},
});