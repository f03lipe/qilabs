/** @jsx React.DOM */

var $ = require('jquery')
var _ = require('lodash')
var React = require('react')
var MediumEditor = require('medium-editor')

var models = require('../components/models.js')
var TagBox = require('./parts/tagBox.js')
var toolbar = require('./parts/toolbar.js')
var Modal = require('./parts/modal.js')

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

var PostEdit = React.createClass({
	getInitialState: function () {
		return {
			subjected: !!this.props.model.get('subject'),
			preview: null,
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
				images: {},
				embeds: {},
			},
		});

		$(self.refs.postBodyWrapper.getDOMNode()).on('click', function (e) {
			if (e.target == self.refs.postBodyWrapper.getDOMNode()) {
				$(self.refs.postBody.getDOMNode()).focus();
			}
		});

		if (this.refs.postLink) {
			var postLink = this.refs.postLink.getDOMNode();
			$(postLink).on('input keyup keypress', function (e) {
				if ((e.keyCode || e.charCode) == 13) {
					e.preventDefault();
					e.stopPropagation();
					return;
				}
			}.bind(this));
			_.defer(function () {
				$(postLink).autosize();
			});
		}

		$(postTitle).on('input keyup keypress', function (e) {
			if ((e.keyCode || e.charCode) == 13) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}
		}.bind(this));

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
			// this.props.model.attributes.type = this.refs.typeSelect.getDOMNode().value;
			this.props.model.attributes.subject = this.refs.subjectSelect.getDOMNode().value;
			this.props.model.attributes.content.link = this.state.preview && this.state.preview.url;
		}
		this.props.model.attributes.tags = this.refs.tagBox.getValue();
		this.props.model.attributes.content.body = this.editor.serialize().postBody.value;
		this.props.model.attributes.content.title = this.refs.postTitle.getDOMNode().value;

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
			this.props.page.destroy();
			// Signal to the wall that the post with this ID must be removed.
			// This isn't automatic (as in deleting comments) posbecause the models on
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
	//
	onChangeLink: function () {
		var link = this.refs.postLink.getDOMNode().value;
		var c = 0;

		function isValidUrl (url) {
			return !!url.match(
				/\b(https?|ftp|file):\/\/[\-A-Za-z0-9+&@#\/%?=~_|!:,.;]*[\-A-Za-z0-9+&@#\/%=~_|‌​]/
			);
		}

		if (!isValidUrl(link)) {
			this.refs.loadingLinks.getDOMNode().innerHTML = "<i class='icon-exclamation-circle'></i>"
			return;
		}

		this.setState({ preview: null });
		var interval = setInterval(function () {
			var e = this.refs.loadingLinks.getDOMNode();
			var ic;
			if (c == 2) ic = "<i class='icon-ellipsis'></i>"
			else if (c == 1) ic = "<i class='icon-dots'></i>"
			else if (c == 0) ic = "<i class='icon-dot'></i>"
			else ic = ""
			e.innerHTML = ic;
			c = (c+1)%3;
		}.bind(this), 700);
		$.getJSON('/api/posts/meta?link='+link)
			.done(function (data) {
				if (!data) {
					this.setState({ preview: false });
				}	else if (data.error) {
					app.flash.warn(data.message || "Problemas ao buscar essa url.");
					return;
				} if (data && !('is_scrapped' in data)) {
					this.setState({ preview: data });
					if (data.title) {
						this.refs.postTitle.getDOMNode().value = data.title;
						_.defer(function () {
							$(this.refs.postTitle.getDOMNode()).trigger('autosize.resize')
						}.bind(this))
					}
				}
			}.bind(this))
			.fail(function () {
			})
			.always(function () {
				clearInterval(interval);
				this.refs.loadingLinks.getDOMNode().innerHTML = '';
			}.bind(this))
	},
	onChangeLab: function () {
		this.props.model.set('subject', this.refs.subjectSelect.getDOMNode().value);
		this.refs.tagBox.changeLab(this.refs.subjectSelect.getDOMNode().value);
	},
	removeLink: function () {
		this.setState({ preview: null });
		this.refs.postLink.getDOMNode().value = '';
	},
	onClickHelp: function () {
		Modal.PostEditHelpDialog({})
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
					<option value={a.id} key={a.id}>{a.name}</option>
				);
			});

		return (
			<div className="postBox">
				<i className="close-btn icon-clear" data-action="close-page" onClick={this.close}></i>
				<div className="formWrapper">
					<div className="flatBtnBox">
						{toolbar.SendBtn({cb: this.onClickSend }) }
						{
							this.props.isNew?
							toolbar.CancelPostBtn({cb: this.onClickTrash })
							:toolbar.RemoveBtn({cb: this.onClickTrash })
						}
						{toolbar.HelpBtn({cb: this.onClickHelp }) }
					</div>
					<div id="formCreatePost">
						<textarea ref="postTitle"
							className="title" name="post_title"
							defaultValue={doc.content.title}
							placeholder="Dê um título para a sua publicação">
						</textarea>
						{
							this.props.isNew || doc.content.link?
							<div className="postLinkWrapper">
								<textarea ref="postLink"
									disabled={!this.props.isNew}
									className="link" name="post_link"
									defaultValue={doc.content.link}
									onChange={_.throttle(this.onChangeLink, 2000)}
									placeholder="OPCIONAL: um link para compartilhar aqui">
								</textarea>
								<div ref="loadingLinks" className="loading">
								</div>
							</div>
							:null
						}

						{
							this.state.preview?
							<div className="preview">
								<i className='icon-close' onClick={this.removeLink}></i>
								{
									this.state.preview.image && this.state.preview.image.url?
									<div className="thumbnail" style={{backgroundImage:'url('+this.state.preview.image.url+')'}}>
										<div className="blackout"></div>
										<i className="icon-link"></i>
									</div>
									:null
								}
								<div className="right">
									{
										this.state.preview.title?
										<div className="title">
											<a href={this.state.preview.url}>
												{this.state.preview.title}
											</a>
										</div>
										:<div className="">
											<a href={this.state.preview.url}>
												{this.state.preview.url}
											</a>
										</div>
									}
									<div className="description">
										{this.state.preview.description}
									</div>
									<div className="hostname">
										<a href={this.state.preview.url}>
											{URL && new URL(this.state.preview.url).hostname}
										</a>
									</div>
								</div>
							</div>
							:(
								this.state.preview === false?
								<div className="preview messaging">
									<div className="message">
										Link não encontrado. <i className="icon-sad"></i>
									</div>
								</div>
								:null
							)
						}

						<div className="line">
							<div className="lab-select-wrapper">
								<i className="icon-group-work"
								data-toggle="tooltip" data-placement="left" data-container="body"
								title="Selecione um laboratório."></i>
								<select ref="subjectSelect" className="lab-select form-control subjectSelect"
									defaultValue={doc.subject}
									disabled={!this.props.isNew}
									onChange={this.onChangeLab}>
									{pagesOptions}
								</select>
							</div>
							<TagBox ref="tagBox" subject={doc.subject}>
								{doc.tags}
							</TagBox>
						</div>
						<div className="bodyWrapper" ref="postBodyWrapper">
							<div id="postBody" ref="postBody"
								data-placeholder="Escreva o seu texto aqui. Selecione partes dele para formatar."
								dangerouslySetInnerHTML={{__html: (doc.content||{body:''}).body }}></div>
						</div>
					</div>
				</div>
			</div>
		);
	},
});

var PostCreate = function (data) {
	var postModel = new models.postItem({
		author: window.user,
		subject: 'application',
		content: {
			title: '',
			body: '',
		},
	});
	return <PostEdit model={postModel} page={data.page} isNew={true} />
};

module.exports = {
	create: PostCreate,
	edit: PostEdit,
};