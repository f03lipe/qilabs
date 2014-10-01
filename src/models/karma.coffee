
# src/models/karma
# for QI Labs
# by @f03lipe

mongoose = require 'mongoose'
async = require 'async'
_ = require 'underscore'
assert = require 'assert'

please = require 'src/lib/please.js'
logger = require('src/core/bunyan')()

ObjectId = mongoose.Schema.ObjectId

Types =
	PostUpvote: 'PostUpvote'
	# CommentUpvote: 'CommentUpvote'

Points = {
	PostUpvote: 10
}

module.exports = ->
module.exports.start = () ->

################################################################################
## Schema ######################################################################

KarmaItemSchema = new mongoose.Schema {
	identifier: { type: String, required: true } # Identifies actions of same nature
	type:		{ type: String, enum: _.values(Types), required: true }
	resource: 	{ type: ObjectId, required: true }
	path: 		{ type: String, required: false }
	object: 	{ } # name, ...
	instances: [{
		identifier: { type: String }
		created_at: { type: Date, default: Date.now, index: 1 }
		name: 	{ type: String, required: true }
		path: 	{ type: String }
		_id:	false
	}]
	multiplier: { type: Number, default: 1 }
	created_at: { type: Date, default: Date.now }
	updated_at:	{ type: Date, default: Date.now, index: 1 }
}
KarmaItemSchema.statics.APISelect = 'resource identifier'

KarmaChunkSchema = new mongoose.Schema {
	user: { type: ObjectId, ref: 'User', required: true, index: 1 }
	items: [KarmaItemSchema]
	updated_at: { type: Date, default: Date.now, index: 1 }
	started_at: { type: Date, default: Date.now }
	last_seen: { type: Date, default: Date.now }
}

KarmaItemSchema.statics.Types = Types
KarmaItemSchema.statics.Points = Points

KarmaItemSchema.plugin(require('./lib/hookedModelPlugin'));
KarmaItem = mongoose.model 'KarmaItem', KarmaItemSchema
KarmaItemSchema.plugin(require('./lib/selectiveJSON'), KarmaItemSchema.statics.APISelect)

KarmaChunkSchema.plugin(require('./lib/trashablePlugin'))
KarmaChunk = mongoose.model 'KarmaChunk', KarmaChunkSchema