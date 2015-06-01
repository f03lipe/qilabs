
mongoose = require 'mongoose'
_ = require 'lodash'
async = require 'async'
jobs = require 'app/config/kue.js'
please = require 'app/lib/please.js'
redisc = require 'app/config/redis'

################################################################################
## Schema ######################################################################

UserSchema = new mongoose.Schema {
	name:					{ type: String, required: true }
	username:			{ type: String, required: true, index: true, unique: true }
	access_token: { type: String }
	facebook_id:	{ type: String, required: true, index: true }
	email:				{ type: String }
	avatar_url:		{ type: String }

	profile: {
		isStaff: 		{ type: Boolean, default: false }
		fbName: 		{ type: String }
		location:		{ type: String, default: '' }
		bio: 				{ type: String, default: ''}
		home: 			{ type: String, default: '' }
		background:	{ type: String }
		serie: 			{ type: String, enum:
			['6-ef','7-ef','8-ef','9-ef','1-em','2-em','3-em','faculdade','pg','esp'] }
		birthday:		{ type: Date }
	}

	stats: {
		karma: 			{ type: Number, default: 0 }
		qiPoints:		{ type: Number, default: 0 }
		# posts:		{ type: Number, default: 0 }
		votes:			{ type: Number, default: 0 }
		followers:	{ type: Number, default: 0 }
		following:	{ type: Number, default: 0 }
	}

	meta: {
		registered: { type: Boolean, default: false }
		session_count: Number
		last_signin_ip: String
		current_signin_ip: String
		last_signin: { type: Date, default: Date.now }
		created_at: { type: Date, default: Date.now }
		updated_at: { type: Date, default: Date.now }
		last_access: { type: Date, default: Date.now }
		last_seen_notifications: { type: Date, default: 0 }
		last_received_notifications: { type: Date, default: 0 }
		karma_from_previous_chunks: { type: Number, default: 0 }
	}

	badges: [{
		# id: 123,
		# amount: 1,
		# first_received: { type: Data, default: Date.now }
		# last_received: { type: Data, default: Date.now }
	}]

	preferences: {
		fbNotifiable: { type: Boolean, default: true }
		labs: []
		subjects: []
	}

	# last_activity: { } # Use to prevent spam? → no, prevent spam with redis

	flags: {
		banned: false
		admin: false
		fake: false
		trust: 0
		mystique: false
		editor: false
	}

	karma_chunks: []
	notification_chunks: []
}, {
	toObject:	{ virtuals: true }
	toJSON: 	{ virtuals: true }
}

UserSchema.statics.APISelect = 'id
	name
	username
	profile
	path
	avatar_url
	avatarUrl
	-slug
	-profile.serie
	-badges
	-profile.birthday'

UserSchema.statics.APISelectSelf = 'id
	name
	username
	profile
	path
	avatar_url
	avatarUrl
	meta.last_seen_notifications
	meta.last_received_notifications
	meta.last_access
	preferences.labs
	preferences.subjects
	flags
	-slug
	-profile.serie
	-profile.birthday'

################################################################################
## Virtuals ####################################################################

UserSchema.methods.getCacheField = (field) ->
	# WTF, I feel like this is unnecessary... use only CacheFields?
	if field of UserSchema.statics.CacheFields
		return UserSchema.statics.CacheFields[field].replace('{id}', @id)
	else
		throw new Error("Field #{field} isn't a valid user cache field.")

UserSchema.statics.CacheFields = {
	Following: 'user:{id}:following'
	Followers: 'user:{id}:followers'
	Profile: 'user:{id}:profile'
}

UserSchema.virtual('avatarUrl').get ->
	if @avatar_url
		@avatar_url+'?width=200&height=200'
	else
		'https://graph.facebook.com/'+@facebook_id+'/picture?width=200&height=200'

UserSchema.virtual('picture').get ->
	if @avatar_url
		@avatar_url+'?width=200&height=200'
	else
		'https://graph.facebook.com/'+@facebook_id+'/picture?width=200&height=200'

UserSchema.virtual('path').get ->
	'/@'+@username

################################################################################
## Middlewares #################################################################

# Must bind to user removal the deletion of:
# - Follows (@=followee or @=follower)
# - Notification (@=agent or @=recipient)
# - Post (@=author)
# - Activity (@=actor)

# TODO! remove cached keys

UserSchema.pre 'remove', (next) ->
	Follow = mongoose.model('Follow')
	Follow.find().or([{followee:@}, {follower:@}]).exec (err, docs) =>
		if docs
			for follow in docs
				follow.remove(->)
		console.log "Removing #{err} #{docs.length} follows of #{@username}"
		next()

UserSchema.pre 'remove', (next) ->
	Post = mongoose.model('Post')
	Post.find {'author.id':@}, (err, docs) =>
		if docs
			for doc in docs
				doc.remove(->)
		console.log "Removing #{err} #{docs.length} posts of #{@username}"
		next()

# UserSchema.pre 'remove', (next) ->
# 	Notification = mongoose.model('Notification')
# 	Notification.find().or([{agent:@},{recipient:@}]).remove (err, docs) =>
# 		console.log "Removing #{err} #{docs} notifications related to #{@username}"
# 		next()

# UserSchema.pre 'remove', (next) ->
	# Activity.remove {actor:@}, (err, docs) =>
	# 	console.log "Removing #{err} #{docs} activities related to #{@username}"
	# 	next()

################################################################################
## related to Following ########################################################

# Get documents of users that @ follows.
UserSchema.methods.getPopulatedFollowers = (cb) ->
	mongoose.model('Follow').find {followee: @_id, follower: {$ne: null}},
	(err, docs) ->
			return cb(err) if err
			User = mongoose.model('User')
			User.populate docs, { path: 'follower' }, (err, popFollows) ->
				if err
					return cb(err)
				cb(null, _.filter(_.pluck(popFollows, 'follower'), (i)->i))

# Get documents of users that follow @.
UserSchema.methods.getPopulatedFollowing = (cb) ->
	mongoose.model('Follow').find {follower: @_id, followee: {$ne: null}},
	(err, docs) ->
			return cb(err) if err
			User = mongoose.model('User')
			User.populate docs, { path: 'followee' }, (err, popFollows) ->
				if err
					return cb(err)
				cb(null, _.filter(_.pluck(popFollows, 'followee'), (i)->i))

#

# Get id of users that @ follows.
UserSchema.methods.getFollowersIds = (cb) ->
	Follow = mongoose.model('Follow')
	Follow.find {followee: @_id, follower: {$ne: null}}, (err, docs) ->
		if err
			return cb(err)
		cb(null, _.pluck(docs or [], 'follower'))

# Get id of users that follow @.
UserSchema.methods.getFollowingIds = (cb) ->
	Follow = mongoose.model('Follow')
	Follow.find {follower: @_id, followee: {$ne: null}}, (err, docs) ->
		if err
			return cb(err)
		cb(null, _.pluck(docs or [], 'followee'))

UserSchema.methods.toMetaObject = ->
	{
		title: @name + " · QI Labs"
		image: @avatarUrl
		description: @name + " e vários outros jovens estão no QI Labs."
		url: "http://www.qilabs.org"+@path
		ogType: "profile"
	}

UserSchema.methods.doesFollowUserId = (userId, cb) ->
	if not (typeof userId is 'string' or userId instanceof mongoose.Types.ObjectId)
		throw 'Passed argument should be either an id.'
	redisc.sismember @getCacheField('Following'), ''+userId, (err, val) =>
		if err
			console.log arguments
			Follow = mongoose.model('Follow')
			Follow.findOne {followee:userId,follower:@_id}, (err, doc) ->
				cb(err, !!doc)
		else
			cb(null, !!val)

UserSchema.methods.seeNotifications = (cb) ->
	User = mongoose.model('User')
	User.findOneAndUpdate { _id: @_id }, { 'meta.last_seen_notifications': Date.now() },
	(err, save) ->
		if err or not save
			console.log("EROOOOO")
			throw err
		cb(null)

UserSchema.methods.getNotifications2 = (limit, cb) ->
	self = @
	Notification2 = mongoose.model("Notification2")
	Notification2.find({ receiver: self._id }).sort('-updated').limit(limit)
		.exec (err, notes) ->
			if err
				throw err
			cb(null, {
				items: notes,
				last_seen: self.meta.last_seen_notifications
				last_update: _.max(_.pluck(notes, 'updated')) || 0
			})

UserSchema.methods.getNotifications = (limit, cb) ->
	self = @
	if @notification_chunks.length is 0
		return cb(null, { items: [], last_seen: Date.now() })
	# TODO: Use cache here if last_sent_notification < last_seen_notifications
	id = @notification_chunks[@notification_chunks.length-1]
	NotificationChunk = mongoose.model('NotificationChunk')
	NotificationChunk.findOne { _id: id }, (err, chunk) ->
		if err
			throw err # Programmer Error
		if not chunk
			return cb(null, {})
		itemsc = _.chain(chunk.toJSON().items)
							.filter (i) ->
								# Notification either doesn't accept instances or
								# has instances
								not i.instances or i.instances.length
							.sortBy((i) -> -i.updated_at)
							.map((i) ->
								if i.instances
									# Slice and sort by date created
									sorted = _.sortBy(i.instances.slice(0,limit), (i) -> -i.created_at)
									return _.extend(i, { instances: sorted })
								else
									return i
							)
							.value()
		cb(null, {
			items: itemsc
			last_seen: self.meta.last_seen_notifications
			last_update: chunk.updated_at
		})

UserSchema.methods.getKarma = (limit, cb) ->
	self = @
	if @karma_chunks.length is 0
		return cb(null, { items: [], last_seen: Date.now() })

	console.log('karma chunks size:', @karma_chunks.length)

	KarmaChunk = mongoose.model('KarmaChunk')
	KarmaChunk.findOne { _id: @karma_chunks[@karma_chunks.length-1] }, (err, chunk) ->
		if err
			throw err # Programmer Error
		if not chunk
			return cb(null, {})
		cb(null, {
			items: _.sortBy(chunk.toJSON().items, (i) -> -i.updated_at)
			last_seen: chunk.last_seen
			karma: self.stats.karma
		})


UserSchema.statics.AuthorSchema = {
		id: String
		username: String
		path: String
		avatarUrl: String
		name: String
	}

UserSchema.statics.toAuthorObject = (user) ->
	{
		id: user.id
		username: user.username
		path: user.path
		avatarUrl: user.avatarUrl
		name: user.name
	}

# Useful inside templates
UserSchema.methods.toSelfJSON = () ->
	@toJSON({
		virtuals: true
		select: UserSchema.statics.APISelectSelf
	})

UserSchema.plugin(require('./lib/hookedModelPlugin'))
UserSchema.plugin(require('./lib/trashablePlugin'))
UserSchema.plugin(require('./lib/fromObjectPlugin'))
UserSchema.plugin(require('./lib/selectiveJSON'), UserSchema.statics.APISelect)

module.exports = UserSchema