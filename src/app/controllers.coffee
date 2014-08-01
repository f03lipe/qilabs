
# app/controllers.coffee
# for qiLabs.org

mongoose = require 'mongoose'
required = require 'src/lib/required'
redis = require 'src/config/redis'
_ = require 'underscore'

Resource = mongoose.model 'Resource'

Post = Resource.model 'Post'
User = Resource.model 'User'

routes = {
	'/':
		name: 'index'
		get: (req, res) ->
			if req.user
				if req.session.signinUp
					# force redirect to sign up
					return req.res.redirect('/signup/finish/1')
				req.user.lastUpdate = new Date()
				res.render 'app/main',
					user_profile: req.user
				req.user.save()
			else
				res.render 'app/front'

	'/entrar':
		get: (req, res) ->
			res.redirect('/api/auth/facebook')

	'/settings':
		name: 'settings'
		permissions: [required.login]
		get: (req, res) ->
			res.render 'app/settings', {}

	'/tags/:tagId':
		permissions: [required.login]
		get: (req, res) ->
			res.render 'app/tag'
			
	'/@:username':
		name: 'profile'
		get: (req, res) ->
			unless req.params.username
				return res.render404()
			User.findOne {username:req.params.username},
				req.handleErrResult (pUser) ->
					pUser.genProfile (err, profile) ->
						if err or not profile
							# req.logMe "err generating profile", err
							return res.render404()
						if req.user
							req.user.doesFollowUser pUser, (err, bool) ->
								res.render 'app/profile', 
									pUser: profile
									follows: bool
						else
							res.render 'app/open_profile',
								pUser: profile

	'/posts/:postId':
		name: 'post'
		get: (req, res) ->
			return unless postId = req.paramToObjectId('postId')
			Post.findOne { _id:postId }, req.handleErrResult((post) ->
				if post.parentPost
					return res.render404()
				if req.user
					post.stuff req.handleErrResult((stuffedPost) ->
						console.log('stuff', stuffedPost.author.id)
						req.user.doesFollowUser stuffedPost.author.id,
							req.handleErrValue((val) ->
								console.log('follows', val)
								res.render 'app/main',
									user_profile: req.user
									post_profile: _.extend(stuffedPost, { meta: { followed: val } })
							)
					)
				else
					post.stuff req.handleErrResult (post) ->
						res.render 'app/open_post.html',
							post: post
			)

	'/sobre':
		name: 'about',
		get: (req, res) ->
			res.render('about/main')


	'/signup/finish':
		permissions: [required.login],
		get: (req, res) ->
			res.redirect('/signup/finish/1')

	'/signup/finish/1':
		permissions: [required.login],

		get: (req, res) ->
			unless req.session.signinUp
				return res.redirect('/')
			res.render('app/signup_1')

		put: (req, res) ->
			trim = (str) -> str.replace(/(^\s+)|(\s+$)/gi, '')

			if typeof req.body.nome isnt 'string' or
			typeof req.body.sobrenome isnt 'string' or
			typeof req.body.email isnt 'string' or
			typeof req.body.nascimento isnt 'string' or
			typeof req.body.ano isnt 'string'
				return res.endJson { error: true, message: "Não recebemos todos os campos." }

			nome = trim(req.body.nome).split(' ')[0]
			sobrenome = trim(req.body.sobrenome).split(' ')[0]
			email = trim(req.body.email)
			nascimento = trim(req.body.nascimento)
			serie = trim(req.body.ano)

			# Name
			req.user.name = nome+' '+sobrenome
			# Email
			if email.match(/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/)
				req.user.email = email
			# Nascimento
			n = parseInt(nascimento)
			if isNaN(n)
				return res.endJson { error: true, message: 'Erro ao ler o ano de nascimento.' }
			else
				n = Math.min(Math.max(1950, n), 2001)
				req.user.profile.anoNascimento = n
			# Série
			validYears = ['6-ef', '7-ef', '8-ef', '9-ef', '1-em', '2-em', '3-em', 'faculdade']
			if not req.body.ano in validYears
				return res.endJson { error: true, message: 'Ano inválido.' }
			else
				req.user.profile.serie = req.body.ano

			req.user.save (err) ->
				if err
					console.log(err);
					return res.endJson { error: true }
				res.endJson { error: false }

	'/signup/finish/2':
		permissions: [required.login],

		get: (req, res) ->
			unless req.session.signinUp
				return res.redirect('/')
			res.render('app/signup_2')

		put: (req, res) ->
			trim = (str) -> str.replace(/(^\s+)|(\s+$)/gi, '')

			# console.log('profile received', req.body)
			# do tests 
			# sanitize
			if req.body.bio
				req.user.profile.bio = bio
				bio = trim(req.body.bio.replace(/^\s+|\s+$/g, '').slice(0,300))
			else
				return res.endJson { error: true, message: 'Escreva uma bio.' }
			if req.body.home
				home = trim(req.body.home.replace(/^\s+|\s+$/g, '').slice(0,35))
				req.user.profile.home = home
			else
				return res.endJson { error: true, message: 'De onde você é?' }
			if req.body.location
				location = trim(req.body.location.replace(/^\s+|\s+$/g, '').slice(0,35))
				req.user.profile.location = location
			else
				return res.endJson { error: true, message: 'O que você faz da vida?' }

			req.user.save (err) ->
				if err
					console.log(err);
					return res.endJson { error: true }
				req.session.signinUp = false
				res.endJson { error: false }

	'/faq':
		name: 'faq',
		get: (req, res) ->
			res.render('about/faq')

	'/blog':
		name: 'blog',
		get: (req, res) ->
			res.redirect('http://blog.qilabs.org')
}

# These correspond to SAP pages, and therefore mustn't return 404.
for n in ['novo', '/posts/:postId/edit']
	routes['/'+n] =
		get: (req, res, next) ->
			if req.user
				res.render 'app/main',
					user_profile: req.user
			else
				res.redirect('/')

module.exports = routes