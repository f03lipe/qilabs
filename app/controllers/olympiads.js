
var mongoose = require('mongoose')
var async = require('async')
var _ = require('lodash')

var required = require('./lib/required')
var psetActions = require('app/actions/psets')
var problemActions = require('app/actions/problems')

module.exports = function(app) {
	var router = require('express').Router()

	var Problem = mongoose.model('Problem')
	var ProblemSet = mongoose.model('ProblemSet')
	var ProblemCache = mongoose.model('ProblemCache')

	router.param('problemId', function(req, res, next, problemId) {
		try {
			var id = mongoose.Types.ObjectId.createFromHexString(problemId)
		} catch (e) {
			return next({ type: 'InvalidId', args:'problemId', value: problemId})
		}
		Problem.findOne({ _id: problemId }, req.handleErr404((problem) => {
			req.problem = problem
			next()
		}))
	})

	router.param('psetSlug', function(req, res, next, psetSlug) {
		ProblemSet.findOne({ slug: psetSlug },
		req.handleErr404((pset) => {
			req.pset = pset
			next()
		}))
	})

	//
	var globalPsets = [];
	ProblemSet.find({}, (err, docs) => {
		if (err) {
			throw err
		}

		async.map(docs, (doc, done) => {
			var json = doc.toJSON()

			json.counts = {
				likes: doc.votes.length,
			};

			globalPsets.push(json)
			done();
		}, (err, results) => {})
	});

	function getGlobalPsets(user) {
		if (user && user.flags.editor) {
			return globalPsets;
		}
		return _.filter(globalPsets, { invisible: false })
	}

	router.get('/olimpiadas', function(req, res) {
		res.render('app/olympiads', {
			pageUrl: '/olimpiadas',
			psets: getGlobalPsets(req.user),
		})
	})

	var n = [
		'/olimpiadas/problemas/novo',
		'/olimpiadas/colecoes/novo',
	]
	n.forEach((n) => {
		router.get(n, required.self.admin, function(req, res) {
			res.render('app/olympiads', {
				pageUrl: '/olimpiadas',
				psets: getGlobalPsets(req.user),
			})
		})
	})

	router.get('/olimpiadas/colecoes/:psetSlug', function(req, res) {
		psetActions.stuffGetPset(req.user, req.pset, (err, json) => {
			res.render('app/olympiads', {
				pageUrl: '/olimpiadas',
				resource: {
					data: json,
				},
				metaResource: req.pset,
				psets: getGlobalPsets(req.user),
			})
		})
	})


	router.get('/olimpiadas/colecoes/:psetSlug/:problemIndex', function(req, res) {
		psetActions.stuffGetPset(req.user, req.pset, (err, json) => {
			if (err) {
				throw err
			}

			Problem.findOne({ localIndex: req.params.problemIndex },
			(err, problem) => {
				if (err) {
					throw err
				}

				if (problem) {
					var resource = {
						title: 'Resolva no QI Labs o problema \''+(problem.title || 'a '+json.fullName)+'\'',
						description: problem.body.slice(0, 300),
						image: problem.thumbnail || req.locals.logo,
						url: 'http://www.qilabs.org'+req.pset.path+'/'+req.params.problemIndex,
						ogType: 'article',
					}
				} else {
					resource = null
				}

				res.render('app/olympiads', {
					pageUrl: '/olimpiadas',
					resource: {
						data: json,
					},
					metaJSON: resource,
					psets: getGlobalPsets(req.user),
				})
			})
		})
	})

	var n = [
		'/olimpiadas/problemas/:problemId',
		'/olimpiadas/problemas/:problemId/editar',
		'/olimpiadas/colecoes/:psetSlug/editar',
	]
	n.forEach((n) => {
		router.get(n, required.self.admin, (req, res) => {
			problemActions.stuffGetProblem(req.user, req.problem,
			req.handleErr404((json) => {
				res.render('app/olympiads', {
					pageUrl: '/olimpiadas',
					resource: {
						data: json,
						type: 'problem',
					},
					metaResource: req.problem,
					psets: getGlobalPsets(req.user),
				})
			}))
		})
	})

	return router
}