module.exports = {
	'jquery': 						{ exports: "$" },
	'bootstrap.dropdown':	{ depends: ['jquery'] },
	'bootstrap.popover':	{ depends: ['jquery', 'bootstrap.tooltip'] },
	'bootstrap.tooltip':	{ depends: ['jquery'] },
	'bootstrap.button':		{ depends: ['jquery'] },
	'bootstrap.tab':			{ depends: ['jquery'] },
	'typeahead':					{ depends: ['jquery'] },
	'typeahead-bundle':		{ depends: ['jquery'] , exports: 'Modernizr', },
	'modernizr':					{ depends: ['jquery'] },
	'bootstrap':					{ depends: ['jquery'] },
	'backbone' :					{ exports: 'Backbone', depends: ['jquery', 'lodash']},
	'autosize':						{ exports: ['jquery'] },
};
