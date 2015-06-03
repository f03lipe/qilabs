
var mongoose = require('mongoose')
var _ = require('lodash')

var required = require('./lib/required')
var labs = require('app/data/labs')

module.exports = function (app) {
	var router = require('express').Router()

	var logger = app.get('logger').child({ childs: 'APP' })

	router.use(function (req, res, next) {
		req.logger = logger
		logger.info("<"+(req.user && req.user.username || 'anonymous@'+
			req.connection.remoteAddress)+">: HTTP "+req.method+" "+req.url)
		next()
	})

	router.use('/signup', (require('./signup'))(app))

	// Deal with signups, new sessions, tours and etc.
	router.use(function (req, res, next) {
		// meta.registered is true when user has finished /signup form
		if (req.user && !req.user.meta.registered) {
			return res.redirect('/signup')
		}

		res.locals.userCache = {};
		if (req.user) {
			res.locals.lastAccess = req.user.meta.last_access
			req.user.meta.last_access = new Date()
			req.user.save()

			req.user.Cacher().onNotifications.get((err, data) => {
				if (err) {
					throw err
				}

				console.log('lastNotified', data)

				res.locals.userCache.lastNotified = data.lastNotified || 0;
				res.locals.userCache.lastSeenNotifications = data.lastSeen || 0;

				next()
			})
		} else {
			next()
		}
	})

	router.get('/links/:link', function (req, res, next) {
		if (req.params.link in app.locals.urls)
			res.redirect(app.locals.urls[req.params.link])
		else {
			res.render404()
		}
	})

	router.use(require('./labs')(app))
	router.use(require('./ranking')(app))
	router.use(require('./profile')(app))

	router.get('/login', (req, res) => { res.redirect('/') })
	router.get('/entrar', (req, res) => { res.redirect('/auth/facebook') })
	router.get('/sobre', (req, res) => { res.render('about/main') })
	router.get('/faq', (req, res) => { res.render('about/faq') })
	router.get('/blog', (req, res) => { res.redirect('http://blog.qilabs.org') })

	router.get('/settings', required.login, (req, res) => {
		res.render('app/settings')
	})

	router.use('/auth', require('./passport')(app))
	router.use('/admin', require('./admin')(app))

	return router
}