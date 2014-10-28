
# src/core/notification
# for QI Labs
# by @f03lipe

mongoose = require 'mongoose'
async = require 'async'
_ = require 'lodash'
assert = require 'assert'

please = require 'src/lib/please'
Chunker = require './chunker'
logger = require('src/core/bunyan')({ service: 'NotificationService' })
TMERA = require 'src/core/lib/tmera'

##

Resource = mongoose.model 'Resource'
ObjectId = mongoose.Schema.ObjectId

User = mongoose.model 'User'
Notification = mongoose.model 'Notification'
NotificationChunk = mongoose.model 'NotificationChunk'

Handlers = {
	'NewFollower': {
		instance: (agent, data) ->
			please {$model:'User'}, {follow:{$model:'Follow'},followee:{$model:'User'}}

			return {
				path: agent.path
				key: 'newfollower_'+data.followee._id+'_'+agent._id
				created_at: data.follow.dateBegin
				updated_at: data.follow.dateBegin
				object: {
					follow: data.follow._id
					name: agent.name
					avatarUrl: agent.avatarUrl
				}
			}
		item: (data) ->
			please {followee:{$model:'User'}}

			return {
				identifier: 'newfollower_'+data.followee._id
				resource: data.followee._id
				type: 'NewFollower'
				object: { }
				receiver: data.followee._id
				instances: []
			}
	},
	'PostComment': {
		instance: (agent, data) ->
			please {$model:'User'}, {parent:{$model:'Post'},comment:{$model:'Comment'}}
			assert agent isnt data.parent.author._id, "I refuse to notify the parent's author"

			return {
				object: {
					name: data.comment.author.name
					path: data.comment.author.path
					date: data.comment.created_at
					avatarUrl: data.comment.author.avatarUrl
					commentId: data.comment._id
				}
				path: agent.path
				key: 'post_comment:tree:'+data.comment.tree+':agent:'+agent._id
				created_at: data.comment.created_at
			}
		item: (data) ->
			please {parent:{$model:'Post'}}

			return {
				identifier: 'postcomment_'+data.parent._id
				resource: data.parent._id
				type: 'PostComment'
				path: data.parent.path # data.comment.path
				object: {
					name: data.parent.content.title
					parentType: data.parent.type
					thumbnail: data.parent.content.image or data.parent.content.link_image
					id: data.parent._id
					lab: data.parent.subject
				}
				receiver: data.parent.author.id
				instances: []
			}
	},
	'CommentReply': {
		instance: (agent, data) ->
			please {$model:'User'},
				{parent:{$model:'Post'},replied:{$model:'Comment'},comment:{$model:'Comment'}}
			assert agent isnt data.parent.author._id, "I refuse to notify the parent's author"

			return {
				object: {
					name: data.comment.author.name
					path: data.comment.author.path
					date: data.comment.created_at
					excerpt: data.comment.content.body.slice(0,100)
					avatarUrl: data.comment.author.avatarUrl
					commentId: data.comment._id
				}
				path: agent.path
				key: 'post_comment:tree:'+data.comment.tree+':replied:'+data.replied._id+':agent:'+agent._id
				created_at: data.comment.created_at
			}
		item: (data) ->
			please {parent:{$model:'Post'},replied:{$model:'Comment'}}

			return {
				identifier: 'commentreply:'+data.replied._id
				resource: data.replied._id
				type: 'CommentReply'
				path: data.replied.path
				object: {
					title: data.parent.content.title
					excerpt: data.replied.content.body.slice(0,100)
					parentType: data.parent.type
					thumbnail: data.parent.content.image or data.parent.content.link_image
					id: data.parent._id
					lab: data.parent.subject
				}
				receiver: data.replied.author.id
				instances: []
			}
	}
}

Generators = {
	CommentReply: (user, cb) ->
		logger = logger.child({ generator: 'CommentReply' })
		Post = mongoose.model('Resource').model('Post')
		User = mongoose.model('User')
		CommentTree = mongoose.model('CommentTree')
		Comment = mongoose.model('Comment')

		Post
			.find { }
			.populate { path: 'comment_tree', model: CommentTree }
			.exec TMERA (docs) ->
				items = []

				# Loop through all posts from that user
				forEachPost = (post, done) ->
					if not post.comment_tree or not post.comment_tree.docs.length
						# logger.debug("No comment_tree or comments for post '%s'", post.content.title)
						return done()
					author_comments = _.filter(post.comment_tree.docs, (i) -> i.author.id is user.id)
					if not author_comments.length
						return done()
					console.log('author comments', author_comments.length, post.content.title)

					forEachComment = (comment, done) ->
						replies_to_that = _.filter(post.comment_tree.docs,
							(i) -> ''+i.replies_to is ''+comment.id)
						if not replies_to_that.length
							return done()

						skin = Handlers.CommentReply.item({
							parent: _.extend(post.toObject(), { comment_tree: post.comment_tree._id }),
							replied: new Comment(comment)
						})
						instances = []
						uniqueAuthors = {}

						forEachReply = (reply, done) ->
							if uniqueAuthors[reply.author.id]
								return done()
							uniqueAuthors[reply.author.id] = true

							User.findOne { _id: reply.author.id }, TMERA (cauthor) ->
								if not cauthor
									logger.error("Author of comment %s of comment_tree %s not found.",
										comment.author.id, post.comment_tree)
									return done()

								console.log("generating instance", reply.content.body.slice(0,100))
								inst = Handlers.CommentReply.instance(cauthor, {
									# Generate unpopulated parent
									parent: _.extend(post, { comment_tree: post.comment_tree._id }),
									# Generate clean comment (without those crazy subdoc attributes like __$)
									replied: new Comment(comment)
									comment: new Comment(reply)
								})
								instances.push(inst)
								done()

						async.map replies_to_that, forEachReply, (err) ->
							if err
								throw err
							if not instances.length
								return done()
							oldest = _.min(instances, 'created_at')
							latest = _.max(instances, 'created_at')
							console.log('oldest', oldest.created_at)
							items.push(new Notification(_.extend(skin, {
								instances: instances
								multiplier: instances.length
								updated_at: latest.created_at
								created_at: oldest.created_at
							})))
							done()

					async.map author_comments, forEachComment, (err) ->
						if err
							throw err
						console.log "forEachComment"
							# logger.warn("Post has comments but no instance was returned.")
						done()

				async.map docs, forEachPost, (err) ->
					if err
						throw err
					console.log "forEachPost"
					cb(null, items)

	PostComment: (user, cb) ->
		logger = logger.child({ generator: 'PostComment' })
		Post = mongoose.model('Resource').model('Post')
		User = mongoose.model('User')
		CommentTree = mongoose.model('CommentTree')
		Comment = mongoose.model('Comment')

		Post
			# .find { 'author.id': user._id, type: Post.Types.Note }
			.find { 'author.id': user._id }
			.populate { path: 'comment_tree', model: CommentTree }
			.exec TMERA (docs) ->
				notifications = []

				forEachPost = (post, done) ->
					instances = []
					if not post.comment_tree or not post.comment_tree.docs.length
						logger.debug("No comment_tree or comments for post '%s'", post.content.title)
						return done()
					skin = Handlers.PostComment.item({
						# Send in unpopulated parent
						parent: _.extend(post.toObject(), { comment_tree: post.comment_tree._id }),
					})
					uniqueAuthors = {}
					# Loop comment_tree entries
					async.map post.comment_tree.docs, ((comment, done) ->
						# Ignore replies to other comments, comments the author made, and authors
						# we already created instances for.
						if comment.thread_root or
						comment.author.id is post.author.id or # 'O
						uniqueAuthors[comment.author.id]
							return done()

						uniqueAuthors[comment.author.id] = true

						User.findOne { _id: comment.author.id }, TMERA (cauthor) ->
							if not cauthor
								logger.error("Author of comment %s of comment_tree %s not found.",
									comment.author.id, post.comment_tree)
								return done()

							inst = Handlers.PostComment.instance(cauthor, {
								# Generate unpopulated parent
								parent: _.extend(post, { comment_tree: post.comment_tree._id }),
								# Generate clean comment (without those crazy subdoc attributes like __$)
								comment: new Comment(comment)
							})
							instances.push(inst)
							done()
					), (err) ->
						if not instances.length
							logger.warn("Post has comments but no instance was returned.")
							return done()
						oldest = _.min(instances, 'created_at')
						latest = _.max(instances, 'created_at')
						console.log('oldest', oldest.created_at)
						notifications.push(new Notification(_.extend(skin, {
							instances: instances
							multiplier: instances.length
							updated_at: latest.created_at
							created_at: oldest.created_at
						})))
						done()

				# Loop through all posts from that user
				async.map docs, forEachPost, (err, results) ->
					cb(null, notifications)
	NewFollower: (user, cb) ->
		logger = logger.child({ generator: 'NewFollower' })
		Follow = mongoose.model('Follow')
		User = mongoose.model('User')

		Follow
			.find { 'followee': user._id }
			.populate { path: 'follower', model: User }
			.exec TMERA (docs) ->
				if docs.length is 0
					return cb(null, [])

				# console.log('docs', docs)
				instances = []
				skin = Handlers.NewFollower.item({ followee: user })
				docs.forEach (follow) ->
					# Get unpopulated follow
					ofollow = new Follow(follow)
					ofollow.follower = follow.follower._id
					data = { follow: ofollow, followee: user }
					instances.push(Handlers.NewFollower.instance(follow.follower, data))
				# console.log("INSTANCES",instances)
				oldest = _.min(instances, 'created_at')
				latest = _.max(instances, 'created_at')
				cb(null, [new Notification(_.extend(skin, {
					instances: instances
					multiplier: instances.length
					updated_at: latest.created_at
					created_at: oldest.created_at # Date of the oldest follow
				}))])
}

##########################################################################################
##########################################################################################

# TODO: Update to only remove notifications of the type we're redoing.

# Create all Notifications for a user, then divide them into Chunks if necessary.
RedoUserNotifications = (user, cb) ->
	please {$model:'User'}, '$isFn'

	logger = logger.child({
		domain: 'RedoUserNotifications',
		# user: { name: user.name, id: user._id }
	})

	async.map _.pairs(Generators), ((pair, done) ->
		generator = pair[1]
		logger.info('Calling generator '+pair[0])
		generator user, (err, items) ->
			done(null, items)
	), (err, _results) ->
		# Chew Notifications that we get as the result
		results = _.sortBy(_.flatten(_.flatten(_results)), 'updated_at')
		latest_update = _.max(results, 'updated_at').updated_at or Date.now()

		logger.debug('Creating new NotificationChunk')
		chunk = new NotificationChunk {
			user: user
			items: results
			updated_at: latest_update
		}
		logger.debug('Saving new Chunk', chunk._id)
		chunk.save TMERA (doc) ->
			# console.log("CHUNK", doc)
			logger.debug('Removing old NotificationChunks')
			NotificationChunk.remove {
				user: user._id
				_id: { $ne: chunk._id }
			}, TMERA (olds) ->
				if olds is 0
					logger.error("No notification chunks were removed")
				logger.debug('Saving user notification_chunks')
				User.findOneAndUpdate {
					_id: user._id
				}, {
					notification_chunks: [chunk._id],
					'meta.last_received_notification': latest_update
				}, TMERA (doc) ->
					cb()


##########################################################################################
##########################################################################################

class NotificationService

	Handlers: Handlers
	Types: Notification.Types

	chunker = new Chunker('notification_chunks', NotificationChunk, Notification,
		Notification.Types, Handlers)

	###*
	 * Fixes duplicate instances of a NotificationChunk item.
	 * @param  {ObjectId} chunkId			[description]
	 * @param  {String} 	instanceKey	[description]
	###
	fixDuplicateChunkInstance = (chunkId, instanceKey, cb = () ->) ->
		please '$ObjectId', '$skip', '$isFn'
		console.log "WTF, Programmer???"
		cb()
		return
		jobs.create({}).delay(3000)

	constructor: () ->

	create: (agent, type, data, cb = () ->) ->

		onAdded = (err, object, instance, chunk) ->
			if err
				throw new Error("CARALGHO")
			if not chunk
				return cb(null)
			User.findOneAndUpdate { _id: object.receiver },
			{ 'meta.last_received_notification': Date.now() }, (err, doc) ->
				if err
					logger.error("Failed to update user meta.last_received_notification")
					throw err
				logger.info("User %s(%s) meta.last_received_notification updated",
					doc.name, doc.id)
				cb(null)

		chunker.add(agent, type, data, onAdded)

	undo: (agent, type, data, cb = () ->) ->

		onRemovedAll = (err, count, object, object_inst) ->
			cb(null)

		chunker.remove(agent, type, data, onRemovedAll)

module.exports = new NotificationService
module.exports.RedoUserNotifications = RedoUserNotifications