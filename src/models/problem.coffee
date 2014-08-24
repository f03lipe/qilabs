
# src/models/problem

mongoose = require 'mongoose'
assert = require 'assert'
_ = require 'underscore'
async = require 'async'

please = require 'src/lib/please.js'
please.args.extend(require('./lib/pleaseModels.js'))

Notification = mongoose.model 'Notification'
Resource = mongoose.model 'Resource'
Inbox = mongoose.model 'Inbox'

Answer = Resource.model 'Answer'

################################################################################
## Schema ######################################################################

ObjectId = mongoose.Schema.ObjectId

ProblemSchema = new Resource.Schema {
	author: {
		id: String
		username: String
		path: String
		avatarUrl: String
		name: String
	}
	
	updated_at:	{ type: Date }
	created_at:	{ type: Date, indexed: 1, default: Date.now }

	subject:	{ type: String }
	topics:		{ type: [{ type: String }] }
	content: {
		title:	{ type: String }
		body:	{ type: String, required: true }
		source:	{ type: String }
		image:  { type: String }
		answer: {
			value: 0,
			options: [],
			is_mc: { type: Boolean, default: true },
		}
	}

	hasAnswered: [],
	hasSeenAnswers: [],
	userTries: [],
	votes: 		{ type: [{ type: String, ref: 'User', required: true }], default: [] }
}, {
	toObject:	{ virtuals: true }
	toJSON: 	{ virtuals: true }
}

ProblemSchema.statics.APISelect = '-hasAnswered -hasSeenAnswers -userTries' # -votes won't work right now

################################################################################
## Virtuals ####################################################################

ProblemSchema.virtual('voteSum').get ->
	@votes.length

ProblemSchema.virtual('path').get ->
	"/problems/{id}".replace(/{id}/, @id)

ProblemSchema.virtual('apiPath').get ->
	"/api/problems/{id}".replace(/{id}/, @id)

################################################################################
## Middlewares #################################################################

ProblemSchema.pre 'remove', (next) ->
	next()
	Notification.find { resources: @ }, (err, docs) =>
		console.log "Removing #{err} #{docs.length} notifications of Problem #{@id}"
		docs.forEach (doc) ->
			doc.remove()

ProblemSchema.pre 'remove', (next) ->
	next()
	Answer.find { problem: @ }, (err, docs) ->
		docs.forEach (doc) ->
			doc.remove()

ProblemSchema.pre 'remove', (next) ->
	next()
	Inbox.remove { resource: @id }, (err, doc) =>
		console.log "Removing #{err} #{doc} inbox of Problem #{@id}"

ProblemSchema.pre 'remove', (next) ->
	next()
	@addToGarbage (err) ->
		console.log "#{err} - moving Problem #{@id} to garbage"

################################################################################
## Methods #####################################################################

ProblemSchema.methods.getAnswers = (cb) ->
	Answer.find { problem: @_id }, cb

ProblemSchema.methods.getFilledAnswers = (cb) ->
	self = @
	self.getAnswers (err, docs) ->
		return cb(err) if err
		async.map docs, ((ans, done) ->
			ans.getComments (err, docs) ->
				done(err, _.extend(ans.toJSON(), { comments: docs}))
		), cb

################################################################################
## Statics #####################################################################

ProblemSchema.statics.fromObject = (object) ->
	new Problem(undefined, undefined, true).init(object)

ProblemSchema.plugin(require('./lib/hookedModelPlugin'))
ProblemSchema.plugin(require('./lib/trashablePlugin'))

module.exports = Problem = Resource.discriminator('Problem', ProblemSchema)