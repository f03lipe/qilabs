/** @jsx React.DOM */

var $ = require('jquery')
var models = require('../components/models.js')
var React = require('react')
var _ = require("underscore")

module.exports = React.createClass({
	close: function () {
		this.props.page.destroy();
	},
	render: function () {
		// <button className='btn-follow' data-action='unfollow'></button>
		var items = _.map(this.props.list, function (person) {
			console.log(person)
			return (
				<li key={person._id}>
					<a href={person.path}>
						<div className='avatarWrapper'>
							<div className='avatar' style={ {background: 'url('+person.avatar_url+')'} }></div>
						</div>
						<span className='name'>{person.name}</span>
					</a>
					{
						(!window.user || window.user.id === person._id)?
						null
						:(
							person.meta.followed?
							<button className='btn-follow' data-action='unfollow' data-user={person._id}></button>
							:<button className='btn-follow' data-action='follow' data-user={person._id}></button>
						)
					}
				</li>
			);
		});
		if (this.props.isFollowing)
			var label = this.props.profile.name+' segue '+this.props.list.length+' pessoas';
		else
			var label = this.props.list.length+' pessoas seguem '+this.props.profile.name;

		return (
			<div className='qi-box'>
				<i className='close-btn' onClick={this.close}></i>
				<label>{label}</label>
				<div className='list'>
					{items}
				</div>
			</div>
		);
	},
});