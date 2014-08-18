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
	'jquery',
	'backbone',
	'components.models',
	'components.postViews',
	'underscore',
	'react',
	'pages.notifications',
	'pages.follows',
	'pages.itemView',
	'components.postForm',
	'components.stream',
	'components.flash'],
	function ($, Backbone, models, postViews, _, React, NotificationsPage, FollowList, ItemView, postForm, StreamView, Flasher) {

	setTimeout(function updateCounters () {
		$('[data-time-count]').each(function () {
			this.innerHTML = calcTimeFrom(parseInt(this.dataset.timeCount), this.dataset.timeLong);
		});
		setTimeout(updateCounters, 1000);
	}, 1000);

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
		$('html').addClass(opts.crop?'crop':'place-crop');

		React.renderComponent(component, e, function () {
			$(e).show().removeClass('invisible');
		});

		if (opts.scrollable)
			$(component.getDOMNode()).addClass('scrollable');

		this.destroy = function (navigate) {
			$(e).addClass('invisible');
			React.unmountComponentAtNode(e);
			$(e).remove();
			document.title = oldTitle;
			$('html').removeClass(opts.crop?'crop':'place-crop');
			if (opts.onClose) {
				opts.onClose();
				opts.onClose = undefined; // Prevent calling twice
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

			$(document).scroll(_.throttle(function() {
				// Detect scroll up?
				// http://stackoverflow.com/questions/9957860/detect-user-scroll-down-or-scroll-up-in-jquery
				if ($(document).height() - ($(window).scrollTop() + $(window).height()) < 50) {
					app.postList.tryFetchMore();
				}
			}, 300));
		},

		flash: new Flasher,

		closePages: function () {
			for (var i=0; i<this.pages.length; i++) {
				this.pages[i].destroy();
			}
			this.pages = [];
		},

		fetchStream: function (source) {
			var urls = { global: '/api/me/global/posts', inbox: '/api/me/inbox/posts', problems: '/api/me/problems' };
			if (source) {
				if (!(source in urls)) {
					throw 'Something?';
				}
				createCookie('qi.feed.source', source);
			} else {
				source = readCookie('qi.feed.source', source) || 'inbox';
			}

			$('.streamSetter').removeClass('active');
			$('.streamSetter[data-stream-source='+source+']').addClass('active');

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
			'problems/:problemId':
				function (problemId) {
					this.triggerComponent(this.components.viewProblem, {id:problemId});
				},
			'problems/:problemId/edit':
				function (problemId) {
					this.triggerComponent(this.components.editProblem, {id:problemId});
				},
			'novo':
				function (postId) {
					this.triggerComponent(this.components.createPost);
				},
			'novo-problema':
				function (postId) {
					this.triggerComponent(this.components.createProblem);
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
				var resource = window.conf.resource;
				// Resource available on page
				if (resource && resource.type === 'post' && resource.data.id === postId) {
					var postItem = new models.postItem(resource.data);
					var p = new Page(ItemView( {type:postItem.get('type'), model:postItem} ), 'post', {
						title: resource.data.content.title,
						crop: true,
						onClose: function () {
							app.navigate('/');
							// Remove window.conf.post, so closing and re-opening post forces us to fetch
							// it again. Otherwise, the use might lose updates.
							window.conf.resource = undefined;
						}
					});
					this.pages.push(p);
				} else {
					$.getJSON('/api/posts/'+postId)
						.done(function (response) {
							if (response.data.parentPost) {
								return app.navigate('/posts/'+response.data.parentPost, {trigger:true});
							}
							console.log('response, data', response);
							var postItem = new models.postItem(response.data);
							var p = new Page(ItemView( {model:postItem} ), 'post', {
								title: postItem.get('content').title,
								crop: true,
								onClose: function () {
									window.history.back();
								}
							});
							this.pages.push(p);
						}.bind(this))
						.fail(function (response) {
							app.flash.alert('Ops! Não conseguimos encontrar essa publicação. Ela pode ter sido excluída.');
						}.bind(this));
				}
			},

			viewProblem: function (data) {
				this.closePages();
				var postId = data.id;
				var resource = window.conf.resource;
				if (resource && resource.type === 'problem' && resource.data.id === postId) {
					var postItem = new models.problemItem(resource.data);
					var p = new Page(ItemView( {type:"Problem", model:postItem} ), 'post', {
						title: resource.data.content.title,
						crop: true,
						onClose: function () {
							app.navigate('/');
							// Remove window.conf.problem, so closing and re-opening post forces us to fetch
							// it again. Otherwise, the use might lose updates.
							window.conf.resource = undefined;
						}
					});
					this.pages.push(p);
				} else {
					$.getJSON('/api/problems/'+postId)
						.done(function (response) {
							if (response.data.parentPost) {
								return app.navigate('/problems/'+response.data.parentPost, {trigger:true});
							}
							console.log('response, data', response);
							var postItem = new models.problemItem(response.data);
							var p = new Page(ItemView( {model:postItem} ), 'post', {
								title: postItem.get('content').title,
								crop: true,
								onClose: function () {
									window.history.back();
								}
							});
							this.pages.push(p);
						}.bind(this))
						.fail(function (response) {
							app.flash.alert('Ops! Não conseguimos encontrar essa publicação. Ela pode ter sido excluída.');
						}.bind(this));
				}
			},

			createProblem: function (data) {
				this.closePages();
				var model = new models.postItem({
					author: window.user,
					content: {
						title: '',
						body: '',
						image: '',
					},
				});
				var p = new Page(postForm.problem({user: window.user, model:model}), 'problemForm', {
					crop: true,
					onClose: function () {
					}
				});
				this.pages.push(p);
			},

			editProblem: function (data) {
				this.closePages();
				$.getJSON('/api/problems/'+data.id)
					.done(function (response) {
						console.log('response, data', response)
						var problemItem = new models.problemItem(response.data);
						var p = new Page(postForm.problem({model: problemItem}), 'problemForm', {
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

			editPost: function (data) {
				this.closePages();
				$.getJSON('/api/posts/'+data.id)
					.done(function (response) {
						if (response.data.parentPost) {
							return alert('eerrooo');
						}
						console.log('response, data', response)
						var postItem = new models.postItem(response.data);
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
				var p = new Page(NotificationsPage(null ), 'notifications', { navbar: false, crop: false });
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
				this.postList = new models.feedList([], {url:url});
			}

			if (!this.postWall) {
				this.postWall = React.renderComponent(StreamView(null ), document.getElementById('qi-stream-wrap'));
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

	return {
		initialize: function () {
			new WorkspaceRouter;
			// Backbone.history.start({ pushState:false, hashChange:true });
			Backbone.history.start({ pushState:true, hashChange: false });
		},
	};
});
