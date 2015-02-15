/** @jsx React.DOM */

var React = require('react')
var PostView = require('./postView.jsx')
var ProblemView = require('./problemView.jsx')

module.exports = React.createClass({
	componentWillMount: function () {
		var update = function () {
			this.forceUpdate(function(){});
		}
		this.props.model.on('add reset remove change', update.bind(this));
		this.props.page.setTitle(this.props.model.get('content').title+' · QI Labs');
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
			app.streamItems.remove({id:this.props.model.get('id')})
			$('.tooltip').remove(); // fuckin bug
		}
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
		if (type === "Problem") {
			var View = React.createFactory(ProblemView);
		} else {
			var View = React.createFactory(PostView);
		}

		return (
			<div className='qi-box' data-post-type={this.props.model.get('type')} data-post-id={this.props.model.get('id')}>
				<i className='close-btn icon-clear' data-action='close-page' onClick={this.close}></i>
				{View({model: this.props.model, parent: this})}
			</div>
		);
	},
});