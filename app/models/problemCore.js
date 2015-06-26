
'use strict'

var mongoose = require('mongoose')

var config = require('app/static/config')

/*
 * Problems don't have authors if they're taken from lists.
 */

var Schema = new mongoose.Schema({
	author: { type: String, ref: 'User', required: false },
	updated: { type: Date },
	created: { type: Date },
	name: { type: String, required: true },
	body: { type: String, required: true },
	source: { type: String, required: true },
	solution: { type: String }, // README. Needed?
	level: { type: Number },
	topic: { type: String },
	subject: { type: String },
	images: [{ type: String }], // a list of image paths in the problem body
	answer: {},
	// If isMultipleChoice, answer is an array, the first element being
	// the right choice. Otherwise, it's a string representing the right answer.
	isMultipleChoice: { type: Boolean, required: true },
	localIndex: { type: Number }, // Indentify the problem's index in its pset.
	pset: { type: String, ref: 'ProblemSet' },
}, {
	toObject: { virtuals: true },
	toJSON: 	{ virtuals: true },
})

Schema.pre('save', function (next) {
	if (!this.created) {
		this.created = new Date()
	}
	if (!this.updated) {
		this.updated = this.created
	}
	next()
})

Schema.virtual('path').get(function() {
	return "/olimpiadas/problemas/{id}".replace(/{id}/, this.id)
})

Schema.virtual('thumbnail').get(function() {
	return this.image || this.author.avatarUrl
})

Schema.virtual('apiPath').get(function() {
	return "/api/problems/{id}".replace(/{id}/, this.id)
})

//

Schema.virtual('materia').get(function () {
	return _Materias[this.subject]
})

Schema.virtual('topico').get(function () {
	var pool = labs[this.subject].topics
	for (var i=0; i<pool.length; ++i) {
		var e = pool[i];
		if (e.id === this.topic) {
			return e.name;
		}
	}
	return '?'
})

Schema.methods.toMetaObject = function () {
	return {
		title: this.name,
		description: this.body.slice(0, 300),
		image: this.images[0] || this.author.avatarUrl,
		url: 'http:\/\/www.qilabs.org'+this.path,
		ogType: 'article',
	}
}

Schema.statics.Topics = config.problemTopics
Schema.statics.Subjects = config.problemSubjects
Schema.statics.Levels = config.problemLevels

module.exports = Schema