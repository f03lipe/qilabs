
# src/core/karma
# for QI Labs
# by @f03lipe

mongoose = require 'mongoose'
async = require 'async'
_ = require 'underscore'
assert = require 'assert'

please = require 'src/lib/please.js'
logger = require('src/core/bunyan')({ child: 'KarmaService' })

Resource = mongoose.model 'Resource'
ObjectId = mongoose.Schema.ObjectId

KarmaItem = mongoose.model 'KarmaItem'
KarmaChunk = mongoose.model 'KarmaChunk'
User = Resource.model 'User'

class KarmaService

	Types: KarmaItem.Types

	# Fix a situtation when the last object in user.karma_chunks doesn't exist.
	fixAndGetKarmaChunk = (user, cb) ->
		please.args({$isModel:'User'}, '$isFn')
		# Identify next logs.
		fixLogger = logger.child({ attemptFix: Math.ceil(Math.random()*100) })
		fixLogger.error('[0] User(%s) supposed KarmaChunk(%s) doesn\'t exist. Attempting
			to fix it.', user._id, user.karma_chunks[user.karma_chunks.length-1])
		# Find KarmaChunks related to the user.
		KarmaChunk
			.find({ user: user._id })
			.sort('updated_at')
			.select('updated_at _id')
			.exec (err, docs) ->
				if err
					fixLogger.error(err, 'Failed finding KarmaChunks for user(%s)', user._id)
					throw err
				if docs.length
				# There are real chunks related to that user. These may or may not have
				# been in the user.karma_chunks array.
					fixLogger.error('[1] %s KarmaChunks found for user.', docs.length)
					# Update user's karma_chunks with correct data.
					console.log(_.pluck(docs, '_id'))
					User.findOneAndUpdate { _id: user._id },
					{ $set: { karma_chunks: _.pluck(docs, '_id') } },
					(err, doc) ->
						if err
							fixLogger.error(err, '[3] Attempted fix: Failed to
								update karma_chunks for user(%s).', user._id)
							return
						fixLogger.error('[3] Attempted fix: Fixed karma_chunks attribute
							for user(%s).', user._id, doc.karma_chunks)
						# Get the last chunk (all of it, now)
						KarmaChunk.findOne { _id: docs[docs.length-1] }, (err, chunk) ->
							if err or not doc
								throw err or new Error('Kill yourself. Really.')
							cb(null, chunk)
				else
				# No chunks related to the user exist? WTF
					fixLogger.error("[1] No KarmaChunk found for user.
						Creating.")
					newAttr = _.pluck(docs, '_id')
					createKarmaChunk user, false, (err, chunk) ->
						if err
							fixLogger.error(err, '2. Failed to create chunk for user(%s)', user._id)
							return cb(err)
						if not chunk
							throw new Error('WTF! created KarmaChunk object is
							 null')
						cb(null, chunk)

	createKarmaChunk = (user, push=false, cb) ->
		please.args({$isModel:'User'}, {$is:false}, '$isFn')
		logger.debug('Creating karma chunk for user %s', user._id)
		chunk = new KarmaChunk {
			user: user._id
		}
		chunk.save (err, chunk) ->
			if err
				logger.error(err, 'Failed to create karma chunk for user(%s)', user._id)
				return cb(err)
			if push
				action = { $push: { karma_chunks: chunk._id } }
			else
				action = { karma_chunks: [chunk._id] }
			User.findOneAndUpdate { _id: user._id }, action, (err) ->
				if err
					logger.error(err,
						'Failed to save karma_chunks (=%s) attribute to user (%s)',
						chunk._id, user._id)
			cb(null, chunk)

	getUserKarmaChunk = (user, cb) ->
		please.args({$isModel:'User'}, '$isFn')
		#
		if user.karma_chunks and user.karma_chunks.length
			# karma_chunks is an array of KarmaChunks objects: bundles of karma updates,
			# the last of which is currently active and holds the latest updates.
			latest = user.karma_chunks[user.karma_chunks.length-1]
			KarmaChunk.findOne { _id: latest }, (err, chunk) ->
				if err
					logger.error(err, 'Failed finding KarmaChunk(%s) for user(%s)',
						latest, user._id)
					throw err
				if chunk
					return cb(null, chunk)
				else
					# OPS! This shouldn't be happening.
					# Log as error and try to fix it.
					# Don't try other ids in karma_chunks.
					fixAndGetKarmaChunk(user, cb)
		else
			# KarmaChunks must be created when they're needed for the first time.
			logger.debug("User (%s) has no karma_chunks.", user._id)
			createKarmaChunk user, false, (err, chunk) ->
				if err
					logger.error(err, 'Failed to create chunk for user(%s)', user._id)
					return cb(err)
				if not chunk
					throw new Error('WTF! created KarmaChunk object is null')
				cb(null, chunk)

	addKarmaToChunk = (item, chunk, cb) ->
		please.args({$isModel:'KarmaItem'}, {$isModel:'KarmaChunk'})
		KarmaChunk.findOneAndUpdate {
			_id: chunk._id
		}, {
			$push: { items: item }
			$set: {
				updated_at: Date.now()
			}
		}, (err, doc) ->
			cb(err, doc)

	updateKarmaInChunk = (item, chunk, cb) ->
		please.args({$isModel:'KarmaItem'}, {$isModel:'KarmaChunk'})
		KarmaChunk.findOneAndUpdate {
			_id: chunk._id
			'items.identifier': item.identifier
		}, {
			$set: {
				updated_at: Date.now()
				'items.$.last_update': Date.now()
			},
			$push: {
				'items.$.instances': item.instances[0]
			},
			$inc: {
				multiplier: 1,
			}
		}, (err, doc) ->
			cb(err, doc)

	## SOO....

	Points = {
		PostUpvote: 5
	}

	Handlers = {
		PostUpvote: (agent, data) ->
			please.args({$isModel:'User'}, {post:{$isModel:'Post'}})

			return {
				identifier: 'upvote_'+data.post._id
				resource: data.post._id
				receiver: data.post.author.id
				instance: { # Specific to the current event
					name: agent.name
					path: agent.path
					identifier: agent._id
					created_at: Date.now()
				}
			}
	}

	## PUBLIC BELOW

	constructor: () ->
		for type of @Types
			assert typeof Handlers[type] isnt 'undefined',
				"Handler for Karma of type #{type} is not registered."
			assert typeof Handlers[type] is 'function',
				"Handler for Karma of type #{type} is not a function."
			assert typeof Points[type] isnt 'undefined',
				"Points for Karma of type #{type} is not registered."

	send: (agent, type, data, cb = () ->) ->
		assert type of @Types, "Unrecognized Karma Type."

		object = Handlers[type](agent, data)
		logger.debug("Karma data", object)

		User.findOne { _id: object.receiver }, (err, user) ->
			if err
				throw err
			if not user
				return cb(new Error("User "+object.receiver+" not found."))

			onAdded = (err, doc) ->
				if err
					return cb(err)
				deltaKarma = Points[type]
				# Ok to calculate karma here. Only one object is assumed to be created.
				User.findOneAndUpdate { _id: object.receiver },
				{ $inc: { 'stats.karma': deltaKarma } }, (err, doc) ->
					if err
						logger.error("Failed to update user karma")
						throw err
					logger.info("User %s(%s) karma updated to %s (+%s)", doc.name,
						doc.id, doc.stats.karma, deltaKarma)
					cb(null)

			getUserKarmaChunk user, (err, chunk) ->
				logger.debug("Chunk found (%s)", chunk._id)
				same = _.findWhere(chunk.items, { identifier: object.identifier })
				if same # Aggregate!
					logger.debug("Aggregating to KarmaChunk", object.instance)
					item = new KarmaItem {
						identifier: object.identifier
						type: type
						resource: object.resource
						instances: [object.instance]
					}
					updateKarmaInChunk item, chunk, (err, doc) ->
						console.log("FOI????", arguments)
						onAdded(err, doc)
				else
					item = new KarmaItem {
						identifier: object.identifier
						type: type
						resource: object.resource
						instances: [object.instance]
					}
					addKarmaToChunk item, chunk, (err, doc) ->
						console.log("FOI????", arguments)
						onAdded(err, doc)

	undo: (agent, type, data, cb = () ->) ->
		assert type of @Types, "Unrecognized Karma Type."

		object = Handlers[type](agent, data)
		logger.debug("Karma data", object)

		User.findOne { _id: object.receiver }, (err, user) ->
			if err
				throw err
			if not user
				return cb(new Error("User "+object.receiver+" not found."))

			count = 0
			onRemovedAll = () ->
				deltaKarma = count*-Points[type]
				User.findOneAndUpdate { _id: object.receiver },
				{ $inc: { 'stats.karma': deltaKarma } }, (err, doc) ->
					if err
						logger.error("Failed to update user karma")
						throw err
					logger.info("User %s(%s) karma updated to %s (%s)", doc.name,
						doc.id, doc.stats.karma, deltaKarma)
					cb(null)

			# Mongo will only take one item at a time in the following update (because $
			# matches only the first array). T'will be necessary for reliance purposes to
			# call this recursively till no item is removed. (ie. num == 1)
			# see http://stackoverflow.com/questions/21637772
			removeAllItems = () ->
				logger.debug("Attempting to remove. count: #{count}")
				KarmaChunk.update {
					user: user._id
					'items.type': type
					'items.resource': object.resource
					'items.instances.identifier': object.instance.identifier
				}, {
					$pull: { 'items.$.instances': { identifier: object.instance.identifier } }
				}, (err, num, info) ->
					if err
						throw err
					if num is 1
						logger.debug("One removed")
						count += 1
						if count > 1
							logger.warn("Removed more than one item: "+count)
						return removeAllItems()
					else
						onRemovedAll()

			removeAllItems()

module.exports = new KarmaService