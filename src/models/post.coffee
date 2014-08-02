
# src/models/post
# Copyright QILabs.org

mongoose = require 'mongoose'
assert = require 'assert'
_ = require 'underscore'
async = require 'async'

please = require 'src/lib/please.js'
please.args.extend(require('./lib/pleaseModels.js'))

Notification = mongoose.model 'Notification'
Resource = mongoose.model 'Resource'
Inbox = mongoose.model 'Inbox'

Types = 
	Experience: 'Experience'
	Tip: 'Tip'
	Question: 'Question'
	Comment: 'Comment'
	Answer: 'Answer'

TransTypes = {}
TransTypes[Types.Question] = 'Pergunta'
TransTypes[Types.Experience] = 'Experiência'
TransTypes[Types.Tip] = 'Dica'
TransTypes[Types.Answer] = 'Resposta'
TransTypes[Types.Comment] = 'Comentário'

################################################################################
## Schema ######################################################################

ObjectId = mongoose.Schema.ObjectId

PostSchema = new Resource.Schema {
	# author:		{ type: ObjectId, ref: 'User', required: true, indexed: 1 }
	author: {}
	# author: {
	# 	id: String,
	# 	username: String,
	# 	path: String,
	# 	avatarUrl: String,
	# 	name: String,
	# }

	parentPost:	{ type: ObjectId, ref: 'Post', required: false }
	
	updated:	{ type: Date }
	published:	{ type: Date, indexed: 1, default: Date.now }
	
	type: 		{ type: String, required: true, enum:_.values(Types) }
	tags:		[{ type: String }]
	content: {
		title:	{ type: String }
		body:	{ type: String, required: true }
	}
	
	votes: 		{ type: [{ type: String, ref: 'User', required: true }], select: true, default: [] }
}, {
	toObject:	{ virtuals: true }
	toJSON: 	{ virtuals: true }
}

################################################################################
## Virtuals ####################################################################

PostSchema.virtual('translatedType').get ->
	TransTypes[@type] or 'Publicação'

PostSchema.virtual('voteSum').get ->
	@votes.length

PostSchema.virtual('path').get ->
	if @parentPost
		"/posts/"+@parentPost+"#"+@id
	else
		"/posts/{id}".replace(/{id}/, @id)

PostSchema.virtual('apiPath').get ->
	"/api/posts/{id}".replace(/{id}/, @id)

################################################################################
## Middlewares #################################################################

PostSchema.pre 'remove', (next) ->
	next()
	Notification.find { resources: @ }, (err, docs) =>
		console.log "Removing #{err} #{docs.length} notifications of post #{@id}"
		docs.forEach (doc) ->
			doc.remove()

PostSchema.pre 'remove', (next) ->
	next()
	Post.find { parentPost: @ }, (err, docs) ->
		docs.forEach (doc) ->
			doc.remove()

PostSchema.pre 'remove', (next) ->
	next()
	Inbox.remove { resource: @id }, (err, doc) =>
		console.log "Removing #{err} #{doc} inbox of post #{@id}"

################################################################################
## Methods #####################################################################

PostSchema.methods.getComments = (cb) ->
	Post.find { parentPost: @id }
		# .populate 'author', '-memberships'
		.exec (err, docs) ->
			cb(err, docs)

PostSchema.methods.stuff = (cb) ->
	@fillChildren(cb)

PostSchema.methods.fillChildren = (cb) ->
	if @type not in _.values(Types)
		return cb(false, @toJSON())

	Post.find {parentPost:@}
		# .populate 'author'
		.exec (err, children) =>
			async.map children, ((c, done) =>
				if c.type in [Types.Answer]
					c.fillChildren(done)
				else
					done(null, c)
			), (err, popChildren) =>
				cb(err, _.extend(@toJSON(), {children:_.groupBy(popChildren, (i) -> i.type)}))

################################################################################
## Statics #####################################################################

PostSchema.statics.countList = (docs, cb) ->
	please.args({$isA:Array}, '$isCb')

	async.map docs, (post, done) ->
		if post instanceof Post
			Post.count {type:'Comment', parentPost:post}, (err, ccount) ->
				Post.count {type:'Answer', parentPost:post}, (err, acount) ->
					done(err, _.extend(post.toJSON(), {childrenCount:{Answer:acount,Comment:ccount}}))
		else done(null, post.toJSON)
	, (err, results) ->
		cb(err, results)


PostSchema.statics.fromObject = (object) ->
	new Post(undefined, undefined, true).init(object)

PostSchema.statics.Types = Types

PostSchema.plugin(require('./lib/hookedModelPlugin'))

module.exports = Post = Resource.discriminator('Post', PostSchema)