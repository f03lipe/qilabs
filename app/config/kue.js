
var kue = require('kue')
var url = require('url')
var nconf = require('nconf')

if (nconf.get('REDISTOGO_URL')) {
	var redisUrl = url.parse(nconf.get('REDISTOGO_URL'))
	var count = 0;

	module.exports = kue.createQueue({
		redis: {
			port: redisUrl.port,
			host: redisUrl.hostname,
			auth: redisUrl.auth && redisUrl.auth.split(':')[1],
		},
	})
} else {
	module.exports = kue.createQueue({})
}