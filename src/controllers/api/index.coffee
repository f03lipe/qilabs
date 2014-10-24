
# src/controllers/api
# for QI Labs
# by @f03lipe

express = require 'express'
unspam = require '../lib/unspam'
bunyan = require 'src/core/bunyan'
required = require '../lib/required'

globalPosts = []
minDate = null

mongoose.model('Resource').model('Post').find { created_at:{ $lt:Date.now() } }
	.sort '-created_at'
	.select '-content.body -participations -type -author.id'
	.limit 10
	.exec (err, docs) ->
		throw err if err
		if not docs.length or not docs[docs.length-1]
			minDate = 0
		else
			minDate = docs[docs.length-1].created_at
		globalPosts = docs

module.exports = (app) ->
	api = express.Router()
	logger = app.get('logger').child({child: 'API'})

	api.use (req, res, next) ->
		req.logger = logger
		req.logger.info("<#{req.user and req.user.username or 'anonymous@'+req.connection.remoteAddress}>: HTTP #{req.method} #{req.url}")
		req.isAPICall = true
		next()

	api.use unspam
	api.get '/openwall', (req, res) ->
		res.endJSON(minDate: 1*minDate, data: globalPosts)
	api.use required.login

	# A little backdoor for debugging purposes.
	api.get '/logmein/:username', (req, res) ->
		if nconf.get('env') is 'production'
			if not req.user or
			not req.user.flags.mystique or
			not req.user.flags.admin
				return res.status(404).end()
		is_admin = not req.user or req.user.flags.admin
		User = require('mongoose').model('User')
		User.findOne { username: req.params.username }, (err, user) ->
			if err
				return res.endJSON(error:err)
			if not user
				return res.endJSON(error:true, message:'User not found')
			if not user.flags.fake and not is_admin
				return res.endJSON(error:true, message:'Não pode.')
			logger.info 'Logging in as ', user.username
			req.login user, (err) ->
				if err
					return res.endJSON(error:err)
				logger.info 'Success??'
				res.redirect('/')

	api.use '/session', require('./session')(app)
	api.use '/posts', require('./posts')(app)
	api.use '/problems', require('./problems')(app)
	api.use '/labs', require('./labs')(app)
	api.use '/me', require('./me')(app)
	api.use '/users', require('./users')(app)

	# Handle 404.
	# Don't 'leak' to other controllers: all /api/ should be satisfied here.
	api.use (req, res) ->
		res.status(404).send({
			error: true,
			message: 'Page not found.'
		});

	api