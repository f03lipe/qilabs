/** @jsx React.DOM */

var $ = require('jquery')
var _ = require('lodash')
var React = require('react')
var MediumEditor = require('medium-editor')
var selectize = require('selectize')

var models = require('../components/models.js')
var TagBox = require('./parts/tagSelect.js')
var toolbar = require('./parts/toolbar.js')

var mediumEditorPostOpts = {
	firstHeader: 'h1',
	secondHeader: 'h2',
	buttons: ['bold', 'italic', 'underline', 'header1', 'header2', 'quote', 'anchor', 'orderedlist'],
	buttonLabels: {
		quote: '<i class="icon-quote-left"></i>',
		orderedlist: '<i class="icon-list"></i>',
		anchor: '<i class="icon-link"></i>'
	}
};

//

var PostEdit = React.createClass({displayName: 'PostEdit',
	getInitialState: function () {
		return {
			placeholder: '',
			subjected: !!this.props.model.get('subject')
		};
	},
	componentDidMount: function () {
		var self = this;
		// Close when user clicks directly on element (meaning the faded black background)
		$(this.getDOMNode().parentElement).on('click', function onClickOut (e) {
			if (e.target === this || e.target === self.getDOMNode()) {
				self.close();
				$(this).unbind('click', onClickOut);
			}
		});
		$('body').addClass('crop');

		var postBody = this.refs.postBody.getDOMNode(),
			postTitle = this.refs.postTitle.getDOMNode();

		// Medium Editor
		// console.log('opts', mediumEditorPostOpts[this.props.model.get('type').toLowerCase()])
		this.editor = new MediumEditor(postBody, mediumEditorPostOpts);
		window.e = this.editor;
		$(postBody).mediumInsert({
			editor: this.editor,
			addons: {
				images: { // imagesUploadScript: "http://notrelative.com", formatData: function (data) {}
				}
			},
		});

		$(self.refs.postBodyWrapper.getDOMNode()).on('click', function (e) {
			if (e.target == self.refs.postBodyWrapper.getDOMNode()) {
				$(self.refs.postBody.getDOMNode()).focus();
			}
		});

		$(postTitle).on('input keyup keypress', function (e) {
			if ((e.keyCode || e.charCode) == 13) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}
			var title = this.refs.postTitle.getDOMNode().value;
			this.props.model.get('content').title = title;
		}.bind(this));

		console.log(this.props.model)
		if (this.props.isNew) {
			console.log(this.refs)
			$(this.refs.subjectSelect.getDOMNode()).on('change', function () {
				console.log(this.value)
				if (this.value == 'Discussion')
					this.setState({placeholder:'O que você quer discutir?'})
				else if (this.value == 'Note')
					this.setState({placeholder:'O que você quer contar?'})
			});
		}

		_.defer(function () {
			$(postTitle).autosize();
		});
	},

	componentWillUnmount: function () {
		// Destroy this.editor and unbind autosize.
		this.editor.deactivate();
		$(this.editor.anchorPreview).remove();
		$(this.editor.toolbar).remove();
		$(this.refs.postTitle.getDOMNode()).trigger('autosize.destroy');
		$('body').removeClass('crop');
	},

	//
	onClickSend: function () {
		if (this.props.isNew) {
			this.props.model.set('type', this.refs.typeSelect.getDOMNode().value);
			this.props.model.set('subject', this.refs.subjectSelect.getDOMNode().value);
		}
		this.props.model.set('tags', this.refs.tagBox.getValue());
		this.props.model.attributes.content.body = this.editor.serialize().postBody.value;

		this.props.model.save(undefined, {
			url: this.props.model.url() || '/api/posts',
			success: function (model, response) {
				window.location.href = model.get('path');
				app.flash.info("Publicação salva! :)");
			},
			error: function (model, xhr, options) {
				var data = xhr.responseJSON;
				if (data && data.message) {
					app.flash.alert(data.message);
				} else {
					app.flash.alert('Milton Friedman.');
				}
			}
		});
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
	//
	close: function () {
		// This check is ugly.
		if ($(this.refs.postBody.getDOMNode()).text() !== '+Img') {
			if (!confirm("Deseja descartar permanentemente as suas alterações?"))
				return;
		}
		this.props.page.destroy();
	},
	onChangeLab: function () {
		this.props.model.set('subject', this.refs.subjectSelect.getDOMNode().value);
		this.refs.tagBox.changeSubject(this.refs.subjectSelect.getDOMNode().value);
	},
	//
	render: function () {
		var doc = this.props.model.attributes;

		var pagesOptions = _.map(_.map(pageMap, function (obj, key) {
				return {
					id: key,
					name: obj.name,
					detail: obj.detail,
				};
			}), function (a, b) {
				return (
					React.DOM.option( {value:a.id, key:a.id}, a.name)
				);
			});

		var _types = {
			'Discussion': 'Discussão',
			'Note': 'Nota',
		};

		// <div className="item save" onClick="" data-toggle="tooltip" title="Salvar rascunho" data-placement="right" onClick={function () { $('#srry').fadeIn()} }>
		// 	<i className="icon-save"></i>
		// </div>

		return (
			React.DOM.div( {className:"postBox"}, 
				React.DOM.i( {className:"close-btn", 'data-action':"close-page", onClick:this.close}),
				React.DOM.div( {className:"formWrapper"}, 
					React.DOM.div( {className:"flatBtnBox"}, 
						toolbar.SendBtn({cb: this.onClickSend}), 
						toolbar.RemoveBtn({cb: this.onClickTrash}), 
						toolbar.HelpBtn({}) 
					),
					React.DOM.div( {id:"formCreatePost"}, 
						React.DOM.div( {className:"selects "+(this.props.isNew?'':'disabled')}, 
							
								this.props.isNew?
								React.DOM.div( {className:""}, 
									React.DOM.span(null, "Postar uma " ),
									React.DOM.select( {ref:"typeSelect", className:"form-control typeSelect",
										disabled:this.props.isNew?false:true, defaultValue:doc.type}, 
										React.DOM.option( {value:"Discussion"}, "Discussão"),
										React.DOM.option( {value:"Note"}, "Nota")
									),
									React.DOM.span(null, "na página de"),
									React.DOM.select( {ref:"subjectSelect", className:"form-control subjectSelect",
										defaultValue:doc.subject, disabled:this.props.isNew?false:true,
										onChange:this.onChangeLab}, 
										pagesOptions
									)
								)
								:React.DOM.div( {className:""}, 
									React.DOM.strong(null, _types[doc.type].toUpperCase()),
									"postada em",
									React.DOM.strong(null, pageMap[doc.subject].name.toUpperCase())
								)
							
						),

						React.DOM.textarea( {ref:"postTitle", className:"title", name:"post_title",
							defaultValue:doc.content.title,
							placeholder:this.state.placeholder || "Sobre o que você quer falar?"}
						),
						TagBox( {ref:"tagBox", subject:doc.subject}, 
							doc.tags
						),
						React.DOM.div( {className:"bodyWrapper", ref:"postBodyWrapper"}, 
							React.DOM.div( {id:"postBody", ref:"postBody",
								'data-placeholder':"Escreva o seu texto aqui.",
								dangerouslySetInnerHTML:{__html: (doc.content||{body:''}).body }})
						)
					)
				)
			)
		);
	},
});

var PostCreate = function (data) {
	var postModel = new models.postItem({
		author: window.user,
		subject: 'application',
		type: 'Discussion',
		content: {
			title: '',
			body: '',
		},
	});
	return PostEdit( {model:postModel, page:data.page, isNew:true} )
};

module.exports = {
	create: PostCreate,
	edit: PostEdit,
};