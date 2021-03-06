
###*
 * Chunker is a data model? for structuring notifications and karma points.
 * It was created to facilitate aggregating items in chunks (ie notifications
 * by type, or karma points by source).
 * The Chunker methods handle creation and deletion (undoing) of these items,
 * as well as ... ?
###

# Documentation? HAH, you wish.

assert = require 'assert'
lodash = require 'lodash'
async = require 'async'
mongoose = require 'mongoose'
bunyan = require 'app/config/bunyan'
please = require 'app/lib/please'
TMERA = require 'app/lib/tmera'

User = mongoose.model 'User'

class Chunker

	logger = bunyan({ service: 'Chunker' })

	# @cfield is an array of ids of @itemModel objects (containing many @itemModel's),
	# the last of which is currently 'active' and holds the latest @itemModels.
	constructor: (@cfield, @chunkModel, @itemModel, @Types, @Handlers, @Generators, @aggregateTimeout=Infinity) ->
		@mname = @chunkModel.modelName
		for type in @Types
			assert typeof @Handlers[type].instance isnt 'undefined',
				'Handler for instance of '+@mname+' of type '+type+' is not registered.'
			assert typeof @Handlers[type].instance is 'function',
				'Handler for instance of '+@mname+' of type '+type+' is not a function.'
			assert typeof @Handlers[type].item isnt 'undefined',
				'Handler for item of '+@mname+' of type '+type+' is not registered.'
			assert typeof @Handlers[type].item is 'function',
				'Handler for item of '+@mname+' of type '+type+' is not a function.'

	# Fix a situtation when the last object the user chunk's id array doesn't exist.
	fixUserAndGetChunk: (user, cb) ->
		please {$model:User}, '$fn'
		# Identify next logs.
		fixLogger = logger.child({ attemptFix: Math.ceil(Math.random()*100) })
		fixLogger.error('[0] User(%s) supposed chunk '+@mname+'(%s) doesn\'t exist. Attempting
			to fix it.', user._id, user[@cfield][user[@cfield].length-1])
		# Find chunks related to the user.
		@itemModel
			.find({ user: user._id })
			.sort('updated_at')
			.select('updated_at _id')
			.exec TMERA (docs) =>
				if docs.length
				# There are real chunks related to that user. These may or may not have
				# been in the @cfield array.
					fixLogger.error('[1] %s '+@chunkModel.modelName+' found for user.', docs.length)
					# Update user's @cfield with correct data.
					update = { $set: {} }
					update.$set[@cfield] = lodash.pluck(docs, '_id')
					User.findOneAndUpdate { _id: user._id }, update, (err, udoc) =>
						if err
							fixLogger.error(err, '[3] Attempted fix: Failed to update '+@cfield+
								' for user(%s).', user._id)
							return
						fixLogger.error('[3] Attempted fix: Fixed '+@cfield+' attribute
							for user(%s).', user._id, udoc[@cfield])
						# Get the last chunk (all of it, now)
						@chunkModel.findOne { _id: docs[docs.length-1] }, (err, chunk) =>
							if err or not udoc
								throw err or new Error('Kill yourself. Really.')
							cb(null, chunk)
				else
				# No chunks related to the user exist? WTF
					fixLogger.error('[1] No '+@chunkModel.modelName+' found for user. Creating.')
					newAttr = lodash.pluck(docs, '_id')
					self.createChunk user, false, (err, chunk) =>
						if err
							fixLogger.error(err, '2. Failed to create chunk for user(%s)', user._id)
							return cb(err)
						if not chunk
							throw new Error('WTF! created '+@chunkModel.modelName+' object is null')
						cb(null, chunk)

	createChunk: (user, push=false, cb) ->
		please {$model:User}, {$is:false}, '$fn' # Non tested consequences for push=true
		logger.debug('Creating '+@chunkModel.modelName+' chunk for user %s', user._id)
		chunk = new @chunkModel {
			user: user._id
		}
		chunk.save (err, chunk) =>
			if err
				logger.error(err, 'Failed to create '+@chunkModel.modelName+' chunk for user(%s)',
					user._id)
				return cb(err)
			if push
				action = { $push: {} }
				action.$push[@cfield] = chunk._id
			else
				action = {}
				action[@cfield] = [chunk._id]
			User.findOneAndUpdate { _id: user._id }, action, (err) =>
				if err
					logger.error(err,
						'Failed to save '+@cfield+' (=%s) attribute to user (%s)',
						chunk._id, user._id)
			cb(null, chunk)

	getFromUser: (user, cb) ->
		please {$model:User}, '$fn'
		self = @

		if user[@cfield] and user[@cfield].length
			latest = user[@cfield][user[@cfield].length-1]
			@chunkModel.findOne { _id: latest }, (err, chunk) =>
				if err
					logger.error(err, 'Failed finding '+@chunkModel.modelName+'(%s) for user(%s)',
						latest, user._id)
					throw err
				if chunk
					return cb(null, chunk)
				else
					# OPS! This shouldn't be happening.
					# Log as error and try to fix it.
					# Don't even try other ids in the @cfield field.
					self.fixUserAndGetChunk(user, cb)
		else
			# Chunks are to be created when they're needed for the first time.
			logger.debug("User (%s) has no "+@chunkModel.modelName+".", user._id)
			self.createChunk user, false, (err, chunk) =>
				if err
					logger.error(err, 'Failed to create chunk for user(%s)', user._id)
					return cb(err)
				if not chunk
					throw new Error('WTF! created '+@chunkModel.modelName+' object is null')
				cb(null, chunk)

	addItemToChunk: (item, chunk, cb) ->
		please {$model:@itemModel}, {$model:@chunkModel}, '$fn'
		@chunkModel.findOneAndUpdate {
			_id: chunk._id
		}, {
			$push: 	{ items: item }
			$set: 	{	updated_at: Date.now() }
		}, TMERA (doc) ->
			cb(null, doc)

	aggregateInChunk: (item, latestItemData, instance, chunk, cb) ->
		please {$model:@itemModel}, '$skip', '$skip', {$model:@chunkModel}, '$fn'
		logger.debug("UPDATE", chunk._id, item)

		@chunkModel.findOneAndUpdate {
			_id: chunk._id
			# 'items.identifier': item.identifier
			'items._id': item._id
		}, {
			$set: {
				updated_at: Date.now()
				'items.$.object': latestItemData # Update object, just in case
			}
			'items.$.updated_at': Date.now()
			$inc: { 'items.$.multiplier': 1 }
			$push: { 'items.$.instances': instance }
		}, cb

	# API

	add: (agent, receiver, type, data, cb) ->
		self = @

		object = self.Handlers[type].item(data)
		# Items of a certain type may not aggregate, by not passing an instance
		# function in their objects.
		if self.Handlers[type].instance
			object_inst = self.Handlers[type].instance(data, agent)

		self.getFromUser receiver, (err, chunk) =>
			logger.debug("Chunk found (%s)", chunk._id)
			###
			 * Now we have chunk, check to see if there are items in it of same type
			 * (same notification identifier). If so, we need to decide whether
			 * we'll add the current notification to this item, as another instance.
			 * If that item was updated more than <self.aggregateTimeout>ms ago,
			 * DON'T aggregate!
			###
			notifs = lodash.where(chunk.items, { identifier: object.identifier })

			makeNewItem = () =>
				logger.info("Make new item")

				if @Handlers[type].aggregate
					ninstance = new self.itemModel(lodash.extend(object, { instances: [object_inst]}))
				else
					ninstance = new self.itemModel(lodash.extend(object))

				self.addItemToChunk ninstance, chunk, (err, chunk) ->
					if err
						logger.error("Failed to addItemToChunk", { instance: ninstance })
						return cb(err)
					cb(null, chunk, object, object_inst)

			aggregateExistingItem = (latestItem) =>
				logger.info("aggregate")
				# Item with that key already exists. Aggregate!
				# Check if instance is already in that item (race condition?)
				if lodash.find(latestItem.instances, { key: object_inst.key })
					logger.warn("Instance with key %s was already in chunk %s (user=%s).",
						object_inst.key, chunk._id, chunk.user)
					return cb(null, null) # No object was/should be added

				# I admit! What de fuk is dis progreming?

				###
				# The data relative to the notification we're creating might have been
				# updated. (For instance, if the post title has changed...)
				###

				latestItemData = (new self.itemModel(object)).object
				self.aggregateInChunk latestItem, latestItemData, object_inst,
				chunk, TMERA (chunk, info) ->
					# What the fuck happened?
					if not chunk
						logger.error("Chunk returned from aggregateInChunk is null",
							object, object_inst)
						return cb(null, null)

					# Check if chunk returned has more than one of the instance we added (likely a
					# race problem).
					item = lodash.find(chunk.items, { identifier: object.identifier })
					try # Hack to use forEach. U mad?
						count = 0
						item.instances.forEach (inst) ->
							if inst.key is object_inst.key
								if count is 1 # This is the second we found
									console.log "ORIGINAL:", object_inst.key
									console.log "SECOND FOUND:", inst.key
									throw new Error("THEHEHEHE")
								count += 1
					catch e
						console.log(e, lodash.keys(e))
						# More than one instances found
						logger.error("Instance with key %s not unique in chunk %s (user=%s).",
							object_inst.key, chunk._id, chunk.user)
						# Trigger fixDuplicateChunkInstance
						self.fixDuplicateChunkInstance chunk._id, object.identifier, () ->
						return cb(null, chunk) # As if no object has been added, because

					cb(null, chunk, object, object_inst)

			if @Handlers[type].aggregate and notifs.length
				latestItem = new @itemModel(lodash.max(notifs, (i) -> i.updated_at))
				# console.log('latestitem')
				# console.log('item', latestItem)
				# console.log('updated_at:', new Date(latestItem.updated_at))
				# console.log(self.aggregateTimeout)
				# console.log(new Date(latestItem.updated_at)*1+self.aggregateTimeout)
				timedout = new Date() > (new Date(latestItem.updated_at)*1+self.aggregateTimeout)
				if timedout
					console.log('TIMEDOUT!')
					makeNewItem()
				else
					aggregateExistingItem(latestItem)
			else
				makeNewItem()

	remove: (agent, receiver, type, data, cb) ->
		object = @Handlers[type].item(data)
		if @Handlers[type].aggregate
			object_inst = @Handlers[type].instance(data, agent)

		count = 0

		if @Handlers[type].aggregate
			# Items of this type aggregate instances, so remove a single instance,
			# not the whole item.

			# Mongo will only take one item at a time in the following update (because $
			# matches only the first array). T'will be necessary to call this until
			# nothing item is removed. (ie. num == 1)
			# see http://stackoverflow.com/questions/21637772
			do removeAllItems = () =>
				data = {
					user: receiver._id
					'items.identifier': object.identifier
					'items.instances.key': object_inst.key
				}
				logger.debug("Attempting to remove. pass number #{count}.", data)

				@chunkModel.update data, {
					$pull: { 'items.$.instances': { key: object_inst.key } }
					$inc: { 'items.$.multiplier': -1 }
				}, TMERA (num, info) =>
					if num is 1
						count += 1
						if count > 1
							logger.error("Removed more than one item: "+count)
						return removeAllItems()
					else
						cb(null, object, object_inst, count)
		else
			# update ALL chunks to user
			@chunkModel.update {
				user: user._id
			}, {
				$pull: { 'items.identifier': object.identifier }
			}, TMERA (num, info) ->
				cb(null, object)

	redoUser: (user, cb) ->
		# This is problematic when dealing with multiple chunks. Do expect bad things to happen.
		# Better to create a reorderChunk routine to deal with it later.
		please {$model:User}, '$fn'

		logger = logger.child({
			domain: 'redoUser'+@itemModel.modelName,
			user: { name: user.name, id: user._id }
		})

		getChunk = (cb) =>
			if user[@cfield].length
				cb(user[@cfield][user[@cfield].length-1])
			else
				chunk = new @chunkModel {
					user: user
					created_at: Date.now()
					updated_at: Date.now()
				}
				chunk.save TMERA (chunk) =>
					update = {}
					update[@cfield] = [chunk._id]
					User.findOneAndUpdate { _id: user._id }, update, TMERA (doc) =>
						if not doc
							throw new Error('Failed to .')
					cb(chunk._id)

		generateToChunk = (chunkId, cb) =>

			replaceChunkItemsOfType = (chunkId, type, items, cb) =>
				# Replaces old items of this type with new ones.
				# With this we don't have to reset the whole chunk with new items from the
				# generators, items with types that don't have generators (points for problem
				# solving?) (yet?) don't vanish when we redo.

				addNew = (chunk) =>
					logger.debug('Pulling of type %s from chunk %s.', type)
					latest_update = lodash.max(lodash.pluck(items, 'updated_at')) or Date.now()
					if chunk.updated_at and chunk.updated_at > latest_update
						latest_update = chunk.updated_at
					console.log latest_update
					@chunkModel.findOneAndUpdate { _id: chunkId },
					{ $push: { items: { $each: items } }, updated_at: latest_update },
					TMERA (chunk) =>
						logger.debug('Pushing of type %s to chunk %s.', type)
						cb(null, chunk)

				@chunkModel.findOneAndUpdate { _id: chunkId },
				{ $pull: { items: { type: type } } }, TMERA (chunk) =>
					console.log(chunk, chunkId, chunk and chunk.items.length)
					addNew(chunk)

			async.map lodash.pairs(@Generators), ((pair, done) =>
				generator = pair[1]
				logger.info('Calling generator '+pair[0])

				generator user, (err, _items) =>
					items = lodash.sortBy(lodash.flatten(_items), 'updated_at')
					replaceChunkItemsOfType chunkId, pair[0], items, (err, chunk) =>
						done(err)
			), (err) =>
				cb(err)

		getChunk (chunkId) =>
			generateToChunk chunkId, (err, chunk) =>
				if err
					throw err
				@chunkModel.findOne { _id: chunkId }, TMERA (doc) =>
					cb(null, doc)

module.exports = Chunker