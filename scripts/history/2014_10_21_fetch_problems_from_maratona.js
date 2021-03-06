
var mongoose = require('mongoose')

jobber = require('../lib/jobber.js')(function (e) {

	var User = mongoose.model("User")
	// var Problem = mongoose.model("Problem")
	var maratonas = require('ignore/maratona.json').them
	var actions = require('app/core/actions/problems')

	function format (data, level) {
		return {
			subject: 'mathematics',
			// topics: ['combinatorics']
			level: level,
			topic: data.topic,
			content: {
				title: data.content.source, // data.content.title,
				body: data.content.body+ (data.content.image && " ![]("+data.content.image+")" || ''),
				solution: data.content.solution,
				source: data.content.source,
			},
			answer: {
				is_mc: false,
				options: null,
				value: data.content.answer,
			}
		}
	}

	var level = 2;
	// var author = ""
	User.findOne({ username: author }, function (err, user) {
		if (err)
			throw err
		if (!user)
			throw new Error("Author not found.");
		//
		console.log("NOME:", maratonas[level-2].name)
		for (var i=0; i<maratonas[level-2].docs.length; ++i) {
			var form = format(maratonas[level-2].docs[i],level)
			// console.log(form)
			// Problem.remove({ 'author.id': user._id }, function () { console.log("DONE?", arguments)})
			actions.createProblem(user, form, function () {
				console.log("CREATED?", arguments)
			})
		}
		// console.log("NOME:", maratonas[1].names)
		// for (var i=0; i<maratonas[1].docs.length; ++i) {
		// 	console.log(format(maratonas[1].docs[i], 3))
		// }
	})

	// actions.createProblem

}).start()