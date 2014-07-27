/** @jsx React.DOM */

/*
** wall.js
** Copyright QILabs.org
** BSD License
** by @f03lipe
*/

function createCookie(name, value, days) {
    if (days) {
        var date = new Date();
        date.setTime(date.getTime()+(days*24*60*60*1000));
        var expires = '; expires='+date.toGMTString();
    }
    else var expires = '';
    document.cookie = name+'='+value+expires+'; path=/';
}

function readCookie(name) {
    var nameEQ = name + '=';
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

function eraseCookie(name) {
    createCookie(name,'',-1);
}
define([
	'jquery', 'backbone', 'components.postModels', 'components.postViews', 'underscore', 'react', 'components.postForm', 'components.stream'],
	function ($, Backbone, postModels, postViews, _, React, postForm, StreamView) {

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
	})

	setTimeout(function updateCounters () {
		$('[data-time-count]').each(function () {
			this.innerHTML = calcTimeFrom(parseInt(this.dataset.timeCount), this.dataset.timeLong);
		});
		setTimeout(updateCounters, 1000);
	}, 1000);

	var FullPostView = React.createClass({displayName: 'FullPostView',

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
			window.location.href = this.props.model.get('path')+'/edit';
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
			console.log('oi')
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
			var post = this.props.model.attributes;
			var author = this.props.model.get('author');
			var postType = this.props.model.get('type');
			if (postType in postViews) {
				var postView = postViews[postType];
			} else {
				console.warn('Couldn\'t find view for post of type '+postType);
				return React.DOM.div(null);
			}

			return (
				React.DOM.div( {className:"postBox", 'data-post-type':this.props.model.get('type'), 'data-post-id':this.props.model.get('id')}, 
					React.DOM.i( {className:"close-btn", 'data-action':"close-page", onClick:this.close}),
					React.DOM.div( {className:"postCol"}, 
						postView( {model:this.props.model, parent:this} )
					)
				)
			);
		},
	});

	var FollowList = React.createClass({displayName: 'FollowList',
		close: function () {
			this.props.page.destroy();
		},
		render: function () {
			// <button className='btn-follow' data-action='unfollow'></button>
			var items = _.map(this.props.list, function (person) {
				return (
					React.DOM.li(null, 
						React.DOM.a( {href:person.path}, 
							React.DOM.div( {className:"avatarWrapper"}, 
								React.DOM.div( {className:"avatar", style: {background: 'url('+person.avatarUrl+')'} })
							),
							React.DOM.span( {className:"name"}, person.name),
							
								(!window.user || window.user.id === person.id)?
								null
								:(
									person.meta.followed?
									React.DOM.button( {className:"btn-follow", 'data-action':"unfollow", 'data-user':person.id})
									:React.DOM.button( {className:"btn-follow", 'data-action':"follow", 'data-user':person.id})
								)
							
						)
					)
				);
			});
			if (this.props.isFollowing)
				var label = this.props.profile.name+' segue '+this.props.list.length+' pessoas';
			else
				var label = this.props.list.length+' pessoas seguem '+this.props.profile.name;

			return (
				React.DOM.div( {className:"cContainer"}, 
					React.DOM.i( {className:"close-btn", onClick:this.close}),
					React.DOM.div( {className:"listWrapper"}, 
						React.DOM.div( {className:"left"}, 
							React.DOM.button( {'data-action':"close-page", onClick:this.close}, "Voltar")
						),
						React.DOM.label(null, label),
						items
					)
				)
			);
		},
	});

	var NotificationsPage = React.createClass({displayName: 'NotificationsPage',
		getInitialState: function () {
			return {notes:[]};
		},
		close: function () {
			this.props.page.destroy();
		},
		componentDidMount: function () {
			var self = this;
			$.ajax({
				url: '/api/me/notifications?limit=30',
				type: 'get',
				dataType: 'json',
			}).done(function (response) {
				if (response.error) {
					if (response.message)
						app.alert(response.message, 'error');
				} else {
					self.setState({notes:response.data});
				}
			});
		},
		render: function () {
			var notes = _.map(this.state.notes, function (item) {
				return (
					React.DOM.li( {className:"notification", key:item.id,
						'data-seen':item.seen, 'data-accessed':item.accessed}, 
						React.DOM.img( {className:"thumbnail", src:item.thumbnailUrl} ),
						React.DOM.p( {onClick:function(){window.location.href=item.url} }, 
							item.msg
						),
						React.DOM.time( {'data-time-count':1*new Date(item.dateSent)}, 
							window.calcTimeFrom(item.dateSent)
						)
					)
				);
			});

			return (
				React.DOM.div( {className:"cContainer"}, 
					React.DOM.i( {className:"close-btn", onClick:this.close}),
					React.DOM.ul( {className:"notificationsWrapper"}, 
						notes
					)
				)
			)
		},
	});

	var Page = function (component, dataPage, opts) {

		var opts = _.extend({}, opts || {
			onClose: function () {}
		});

		component.props.page = this;
		var e = document.createElement('div');
		this.e = e;
		this.c = component;
		if (!opts.navbar)
			$(e).addClass('pContainer');
		$(e).addClass((opts && opts.class) || '');
		$(e).addClass('invisible').hide().appendTo('body');
		if (dataPage)
			e.dataset.page = dataPage;
		var oldTitle = document.title;
		if (opts.title) {
			document.title = opts.title;
		}
		if (opts.crop) {
			$('html').addClass('crop');
		}

		React.renderComponent(component, e, function () {
			$(e).show().removeClass('invisible');
		});

		if (opts.scrollable)
			$(component.getDOMNode()).addClass('scrollable');

		this.destroy = function (navigate) {
			$(e).addClass('invisible');
			React.unmountComponentAtNode(e);
			$(e).remove();
			if (opts.onClose) {
				opts.onClose();
				opts.onClose = undefined; // Prevent calling twice
			}
			document.title = oldTitle;
			if (opts.crop) {
				$('html').removeClass('crop');
			}
		};
	};

	$('.streamSetter').click(function () {
		var source = this.dataset.streamSource;
		app.fetchStream(source);
	});

	// Todo:
	// simplify WorkspaceRouter:
	// - remove alert display from app object
	// 

	// Central functionality of the app.
	var WorkspaceRouter = Backbone.Router.extend({
		initialize: function () {
			console.log('initialized')
			window.app = this;
			this.pages = [];
			this.renderWall(window.conf.postsRoot);
			this.fd = React.renderComponent(FlashDiv(null ), $('<div id=\'flash-wrapper\'>').appendTo('body')[0]);

			$(document).scroll(_.throttle(function() {
				// Detect scroll up?
				// http://stackoverflow.com/questions/9957860/detect-user-scroll-down-or-scroll-up-in-jquery
				if ($(document).height() - ($(window).scrollTop() + $(window).height()) < 50) {
					app.postList.tryFetchMore();
				}
			}, 300));
		},

		alert: function (message, className, wait) {
			this.fd.message(message, className, wait);
		},

		closePages: function () {
			for (var i=0; i<this.pages.length; i++) {
				this.pages[i].destroy();
			}
			this.pages = [];
		},

		fetchStream: function (source) {
			var urls = { global: '/api/me/global/posts', inbox: '/api/me/inbox/posts' };
			if (source) {
				if (!(source in urls)) {
					throw 'Something?';
				}
				createCookie('qi.feed.source', source);
			} else {
				source = readCookie('qi.feed.source', source) || 'inbox';
			}

			$('.streamSetter').removeClass('active');
			$('.streamSetter[data-stream-source='+source+'').addClass('active');

			if (this.postList.url == urls[source])
				return;
			
			this.postList.url = urls[source];
			this.postList.reset();
			this.postList.fetch({reset:true});
		},

		triggerComponent: function (comp, args) {
			comp.call(this, args);
		},

		routes: {
			'posts/:postId':
				function (postId) {
					this.triggerComponent(this.components.viewPost, {id:postId});
				},
			'posts/:postId/edit':
				function (postId) {
					this.triggerComponent(this.components.editPost, {id:postId});
				},
			'':
				function () {
					this.closePages();
				},
		},

		components: {
			viewPost: function (data) {
				this.closePages();
				var postId = data.id;
				if (window.conf.post && window.conf.post.id === postId) {
					var postItem = new postModels.postItem(window.conf.post);
					var p = new Page(FullPostView( {model:postItem} ), 'post', {
						title: window.conf.post.content.title,
						crop: true,
						onClose: function () {
							// Remove window.conf.post, so closing and re-opening post forces us to fetch
							// it again. Otherwise, the use might lose updates.
							window.conf.post = {};
						}
					});
					this.pages.push(p);
				} else {
					$.getJSON('/api/posts/'+postId)
						.done(function (response) {
							if (response.data.parentPost) {
								return app.navigate('/posts/'+response.data.parentPost, {trigger:true});
							}
							console.log('response, data', response)
							var postItem = new postModels.postItem(response.data);
							var p = new Page(FullPostView( {model:postItem} ), 'post', {
								title: postItem.get('content').title,
								crop: true,
							});
							this.pages.push(p);
						}.bind(this))
						.fail(function (response) {
							app.alert('Ops! Não conseguimos encontrar essa publicação. Ela pode ter sido excluída.', 'error');
						}.bind(this));
				}
			},
			editPost: function (data) {
				this.closePages();
				$.getJSON('/api/posts/'+data.id)
					.done(function (response) {
						if (response.data.parentPost) {
							return alert('eerrooo');
						}
						console.log('response, data', response)
						var postItem = new postModels.postItem(response.data);
						var p = new Page(postForm.edit({model: postItem}), 'postForm', {
							crop: true,
							onClose: function () {
								window.history.back();
							},
						});
						this.pages.push(p);
					}.bind(this))
					.fail(function (response) {
						alert('não achei');
					}.bind(this));
			},

			createPost: function () {
				this.closePages();
				var p = new Page(postForm.create({user: window.user}), 'postForm', {
					crop: true,
					onClose: function () {
					}
				});
				this.pages.push(p);
			},

			following: function (data) {
				var userId = data.id;
				var self = this;
				$.getJSON('/api/users/'+userId+'/following')
					.done(function (response) {
						if (response.error)
							alert('vish fu')
						var p = new Page(FollowList( {list:response.data, isFollowing:true, profile:user_profile} ),
							'listView', {navbar: true, scrollable: true});
						this.pages.push(p);
					})
					.fail(function (response) {
						alert('vish');
					});
			},

			followers: function (data) {
				var userId = data.id;
				var self = this;
				$.getJSON('/api/users/'+userId+'/followers')
					.done(function (response) {
						if (response.error)
							alert('vish fu')
						var p = new Page(FollowList( {list:response.data, isFollowing:false, profile:user_profile} ),
							'listView', {navbar: true, scrollable: true});
						this.pages.push(p);
					})
					.fail(function (response) {
						alert('vish');
					});
			},

			notifications: function (data) {
				this.closePages();
				var p = new Page(NotificationsPage(null ), 'notes', { navbar: false, crop: true });
				this.pages.push(p);
			},
		},

		trigger: function () {
			// Trigger the creation of a component
		},

		renderWall: function (url) {
			if (this.postList && (!url || this.postList.url === url)) {
				// If there already is a postList and no specific url, app.fetchStream() should have been
				// called instead.
				return;
			}

			if (!this.postList) {
				this.postList = new postModels.postList([], {url:url});
			}

			if (!this.postWall) {
				this.postWall = React.renderComponent(StreamView(null ), document.getElementById('resultsContainer'));
				this.postList.on('add update change remove reset statusChange', function () {
					this.postWall.forceUpdate(function(){});
				}.bind(this));
			}

			if (!url) {
				app.fetchStream();
			} else {
				this.postList.reset();
				this.postList.url = url;
				this.postList.fetch({reset:true});
			}

			this.postList.fetch({reset:true});			
		},
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
			if (dataset.page in app.components) {
				var data = {};
				if (dataset.args) {
					try {
						data = JSON.parse(dataset.args);
					} catch (e) {
						console.error('Failed to parse data-args '+dataset.args+' as JSON object.');
						console.error(e.stack);
					}
				}
				app.components[dataset.page].call(app, data);
			} else {
				console.warn('Router doesn\'t contain component '+dataset.page+'.')
			}
		}
	});

	return {
		initialize: function () {
			new WorkspaceRouter;
			// Backbone.history.start({ pushState:false, hashChange:true });
			Backbone.history.start({ pushState:true, hashChange: false });
		},
	};
});
