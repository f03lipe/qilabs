
# app/models/follow
# for QI Labs
# by @f03lipe

mongoose = require 'mongoose'

FollowSchema = new mongoose.Schema {
	created_at:	{ type: Date, default: Date.now }
	follower: 	{ type: mongoose.Schema.ObjectId, index: 1 }
	followee: 	{ type: mongoose.Schema.ObjectId, index: 1 }
}

FollowSchema.plugin(require('./lib/hookedModelPlugin'))
FollowSchema.plugin(require('./lib/fromObjectPlugin'))

module.exports = FollowSchema