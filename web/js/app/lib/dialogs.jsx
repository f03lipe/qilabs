
var $ = require('jquery')
var _ = require('lodash')
var React = require('react')

var Box = React.createClass({
	componentDidMount: function () {
		var self = this;
		$('body').on('keypress', function(e){
			if (e.which === 27){
				self.close();
			}
		});
	},

	close: function () {
		this.props.close();
	},

	render: function () {
		return (
			<div>
				<div className="Dialog-blackout" onClick={this.close} data-action="close-dialog"></div>
				<div className="Dialog-box">
					<i className='close-btn' onClick={this.close} data-action='close-dialog'></i>
					{this.props.children}
				</div>
			</div>
		);
	}
});

var Dialog = function (component, className, onRender, onClose) {
	var $el = $('<div class="Dialog">').appendTo("body");
	if (className) {
		$el.addClass(className);
	}
	function close () {
		$el.fadeOut();
		React.unmountComponentAtNode($el[0]);
		onClose && onClose($el[0], c);
	}
	component.props.close = close;
	var c = React.render(<Box close={close}>{component}</Box>, $el[0],
		function () {
			// Defer execution, so variable c is set.
			setTimeout(function () {
				$el.fadeIn();
				onRender && onRender($el[0], c);
				$('body').focus();
			}, 10);
		});
}

//

var Share = React.createClass({
	render: function () {
		var urls = {
			facebook: 'http://www.facebook.com/sharer.php?u='+encodeURIComponent(this.props.url)+
				'&ref=fbshare&t='+encodeURIComponent(this.props.title),
			gplus: 'https://plus.google.com/share?url='+encodeURIComponent(this.props.url),
			twitter: 'http://twitter.com/share?url='+encodeURIComponent(this.props.url)+
				'&ref=twitbtn&via=qilabsorg&text='+encodeURIComponent(this.props.title),
		}

		function genOnClick(url) {
			return function () {
				window.open(url,"mywindow","menubar=1,resizable=1,width=500,height=500");
			};
		}

		return (
			<div>
				<label>{this.props.message}</label>
				<input type="text" name="url" readOnly value={this.props.url} />
				<div className="share-icons">
					<button className="share-gp" onClick={genOnClick(urls.gplus)}
						title="Compartilhe essa questão no Google+">
						<i className="icon-google"></i> Google+
					</button>
					<button className="share-fb" onClick={genOnClick(urls.facebook)}
						title="Compartilhe essa questão no Facebook">
						<i className="icon-facebook"></i> Facebook
					</button>
					<button className="share-tw" onClick={genOnClick(urls.twitter)}
						title="Compartilhe essa questão no Twitter">
						<i className="icon-twitter"></i> Twitter
					</button>
				</div>
			</div>
		);
	},
});

var Markdown = React.createClass({
	render: function () {
		return (
			<div>
				<label>Como usar Markdown</label>
				<p>
					Markdown é um conjunto de códigos para formatar o seu código.
				</p>
				<table className="table table-bordered">
					<thead>
						<tr>
							<th>Resultado</th>
							<th>Markdown</th>
						</tr>
					</thead>
					<tr>
						<td><strong>negrito</strong></td>
						<td>**negrito**</td>
					</tr>
					<tr>
						<td><a href="#">link</a></td>
						<td>[link](http://)</td>
					</tr>
					<tr>
						<td><del>Riscado</del></td>
						<td>~~Riscado~~</td>
					</tr>
				</table>
			</div>
		);
	},
});

var PostEditHelp = React.createClass({
	render: function () {
		return (
			<div>
				<h1>Como editar seu texto</h1>
				<p>
					Você pode formatar os seus textos para conter títulos, links, imagens etc. Para isso, você deve utilizar códigos da linguagem de formatação conhecida como "Markdown".
				</p>
				<hr />
				<label>Como usar Markdown</label>
				<p>
					Markdown é um conjunto de códigos para formatar o seu código.
				</p>
				<table className="table table-bordered">
					<thead>
						<tr>
							<th>Resultado</th>
							<th>Markdown</th>
						</tr>
					</thead>
					<tr>
						<td><strong>negrito</strong></td>
						<td>**negrito**</td>
					</tr>
					<tr>
						<td><a href="#">link</a></td>
						<td>[link](http://)</td>
					</tr>
					<tr>
						<td><del>Riscado</del></td>
						<td>~~Riscado~~</td>
					</tr>
				</table>

			</div>
		);
	},
});

var FFF = React.createClass({
	getInitialState: function() {
		return {
			friends: [],
		};
	},
	componentWillMount: function() {
		$.ajax({
			type: 'get',
			dataType: 'json',
			timeout: 4000,
			url: '/api/me/fff',
		})
		.done(function (response) {
			if (response.error) {
				Utils.flash.alert(response.message || "Erro!")
			} else {
				this.setState({
					friends: response.data
				});
			}
		}.bind(this))
		.fail(function (xhr) {
			if (xhr.responseJSON && xhr.responseJSON.limitError) {
				Utils.flash.alert("Espere um pouco para realizar essa ação.");
			}
		}.bind(this));
	},
	render: function () {
		var Friends = _.map(this.state.friends, function (f) {
			return (
				<li>
					<div className="user-avatar">
						<div className="avatar" style={{background: 'url('+f.picture+')'}}>
						</div>
					</div>
					<div className="name">
						{f.name}
					</div>
					<div className="right">
					</div>
				</li>
			);
		});
		return (
			<div>
				<h1>Seus amigos usando o QI Labs</h1>
				<ul>
					{Friends}
				</ul>
			</div>
		);
	},
});

var Intro = React.createClass({
	render: function () {
		function login () {
			window.open("/entrar");
		}
		var close = function () {
			console.log('close', this.props.close)
			this.props.close();
		}.bind(this)
		return (
			<div>
				<i className='icon-lightbulb'></i>
				<h1>
					Bem-vindo ao <strong>QI Labs</strong>!
				</h1>
				<h3>
					Uma plataforma para extra-curriculares.
				</h3>

				<p>
					Aqui você pode ler textos sobre <a href="/labs/matematica" target="__blank" className="tag tag-color" data-tag="mathematics">Olimpíadas de Matemática</a>, compartilhar experiências sobre <a href="/labs/empreendedorismo" target="__blank" className="tag tag-color" data-tag="entrepreneurship">empreendedorismo</a>, ou fazer perguntas sobre <a href="/labs/fisica" target="__blank" className="tag tag-color" data-tag="physics">Fìsica Moderna</a>.
				</p>

				<button className="login-fb" onClick={login}>Entrar com o Facebook</button>
				<p>
					<button className="continue" onClick={close}>continuar explorando o site</button>
				</p>
			</div>
		);
	},
});

var Tour = React.createClass({
	render: function () {
		return (
			<div className=''>
				<div className='header'>
					<i className='icon-lightbulb'></i>
					<h1>Bem-vindo ao <strong>QI Labs</strong>!</h1>
				</div>
				<p>
					Aqui você pode ler textos sobre <a href="/labs/matematica" target="__blank" className="tag tag-color" data-tag="mathematics">Olimpíadas de Matemática</a>, compartilhar experiências sobre <a href="/labs/empreendedorismo" target="__blank" className="tag tag-color" data-tag="entrepreneurship">empreendedorismo</a>, ou fazer perguntas sobre <a href="/labs/fisica" target="__blank" className="tag tag-color" data-tag="physics">Fìsica Moderna</a>.
				</p>
				<p>
					Agora que você tem uma conta você pode:
					<ul>
						<li><strong>participar de discussões</strong> e <strong>receber notificações</strong></li>
						<li><strong>seguir pessoas</strong> que te interessarem (intelectualmente, claro)</li>
						<li><strong>resolver problemas</strong> e ganhar pontos</li>
					</ul>
				</p>
				<p>
					<strong>Clique nas bolinhas azuis para aprender a usar melhor o site.</strong>
				</p>
				<button className="go" onClick={this.props.close}>
					Go!
				</button>
			</div>
		);
	},
});

//

module.exports = Dialog;

module.exports.PostEditHelp = function (data, onRender) {
	Dialog(
		React.createElement(PostEditHelp, data),
		"postedithelp-dialog",
		function (elm, component) {
			onRender && onRender.call(this, elm, component);
		},
		function (elm, component) {
		}
	);
};

module.exports.FacebookShare = function (data, onRender) {
	var url = 'http://www.facebook.com/sharer.php?u='+
		encodeURIComponent(data.url)+
		'&ref=fbshare&t='+
		encodeURIComponent(data.title);
	console.log(url)

	window.open(url,"mywindow","menubar=1,resizable=1,width=500,height=500");
};

module.exports.Share = function (data, onRender) {
	Dialog(
		React.createElement(Share, data),
		"share-dialog",
		function (elm, component) {
			$(component.getDOMNode()).find('input').focus();
			onRender && onRender.call(this, elm, component);
			// app.pages.chop();
		},
		function (elm, component) {
			// app.pages.unchop();
		}
	);
};

module.exports.Intro = function (data, onRender) {
	Dialog(
		React.createElement(Intro, data),
		"intro-dialog",
		function (elm, component) {
			onRender && onRender.call(this, elm, component);
			// app.pages.chop();
		},
		function (elm, component) {
			// app.pages.unchop();
		}
	);
};

module.exports.Markdown = function (data, onRender) {
	Dialog(
		React.createElement(Markdown, data),
		"markdown-dialog",
		function (elm, component) {
			onRender && onRender.call(this, elm, component);
		},
		function (elm, component) {
		}
	);
};

module.exports.Tour = function (data, onRender, onClose) {
	Dialog(
		React.createElement(Tour, data),
		"tour-dialog",
		function (elm, component) {
			onRender && onRender.call(this, elm, component);
			// app.pages.chop();
		},
		function (elm, component) {
			onClose && onClose.call(this, elm, component);
			// app.pages.unchop();
		}
	);
};

module.exports.FFF = function (data, onRender) {
	Dialog(
		React.createElement(FFF, data),
		"fff-dialog",
		function (elm, component) {
			onRender && onRender.call(this, elm, component);
			// app.pages.chop();
		},
		function (elm, component) {
			// app.pages.unchop();
		}
	);
};