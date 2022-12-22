var http = require('http'), fs = require('fs');

var RouterOptions = {
	"baseMessageDir" : "",
	"JSONMessageFile" : './test/server/message.json',
	"XMLMessageFile" : './test/server/message.xml'

};

var RouteManager = {
	"findRoute" : function(req, res) {
		var handler = null;
		for ( var route in this.routes) {
			if (req.url.startsWith(route)) {
				handler = this.routes[route];
			}

		}
		if (!handler)
			throw "cannot find route " + req.url;
		handler.call(this, req, res);
	},
	"routes" : {
		"/json" : function(req, res) {
			// this.sleep(5000);
			var message = fs
					.readFileSync(RouterOptions.JSONMessageFile, 'utf8');
			res.writeHead(200, {
				'Content-Type' : 'application/json',
				'test-header'  : 'test'
			});
			res.write(message.toString());
			res.end();
		},
		"/json/path" : function(req, res) {
			// this.sleep(5000);
			var message = {
				"url" : req.url
			};
			res.writeHead(200, {
				'Content-Type' : 'application/json',
				'test-header'  :  req.url
			});
			res.write(JSON.stringify(message));
			res.end();
		},
		"/xml" : function(req, res) {
			var message = fs.readFileSync(RouterOptions.XMLMessageFile, 'utf8');
			res.writeHead(200, {
				'Content-Type' : 'application/xml'
			});
			res.write(message.toString());
			res.end();
		},
		"/120/json?arg1=hello&arg2=world" : function(req, res) {
			if (!req.headers["test-header"])
				throw "no test-header found!!";
			res.setHeader("test-response-header", req.headers["test-header"]);
			this.routes["/json"](req, res);
		},
		"/json?post" : function(req, res) {
			req.on('data', function(data) {
				// console.log("[SERVER] data = ", data);
				res.writeHead(200, {
					'Content-Type' : 'application/json'
				});
				// res.writeHead(200, {'Content-Type': 'text/plain'});
				res.write(data.toString());
				res.end();
			});

		},
		"/json/path/post" : function(req, res) {
			req.on('data', function(data) {
				var message = {
					"url" : req.url
				};
				// console.log("[SERVER] data = ", data);
				res.writeHead(200, {
					'Content-Type' : 'application/json'
				});
				// res.writeHead(200, {'Content-Type': 'text/plain'});
				message.postData = data.toString();
				res.write(JSON.stringify(message));
				res.end();
			});

		},
		"/json/error" : function(req, res) {
			// this.sleep(5000);
			

			res.writeHead(500, {'Content-Type': 'text/plain'});
			res.end();
			

		},
		"/xml/path/post" : function(req, res) {
			req.on('data', function(data) {
				// console.log("[SERVER] data = ", data);
				res.writeHead(200, {
					'Content-Type' : 'application/xml'
				});
				// res.writeHead(200, {'Content-Type': 'text/plain'});				
				res.write(data.toString());
				res.end();
			});

		},
		"/json/empty" : function(req, res) {
			res.writeHead(200, {
				'Content-Type' : 'application/json'
			});
			res.end();
		},
		"/xml/empty" : function(req, res) {
			res.writeHead(204, {
				'Content-Type' : 'application/xml'
			});
			res.end();
		},
		"/json/contenttypewithspace" : function(req, res) {
			var message = fs.readFileSync('./message.json', 'utf8');
			res.writeHead(200, {
				'Content-Type' : 'application/json; charset=utf-8'
			});
			res.write(message.toString());
			res.end();
		},
		"/json/test/content/type" : function(req, res) {
			var message = fs.readFileSync(RouterOptions.JSONMessageFile, 'utf8');
			res.writeHead(200, {
				'Content-Type' : 'test/json'
			});
			res.write(message.toString());
			res.end();
		},
		"/xml/test/content/type" : function(req, res) {
			var message = fs.readFileSync(RouterOptions.XMLMessageFile, 'utf8');
			res.writeHead(200, {
				'Content-Type' : 'test/xml'
			});
			res.write(message.toString());
			res.end();
		},
		"/followRedirects":function(req, res){

			var repeatOffset = req.url.indexOf("?"),
			repeat = parseInt(req.url.substring(repeatOffset + 1),10),
			location  = "";

			if (repeatOffset === 0){
				res.writeHead(301, {
					'Location':'http://localhost:4444/redirected'
				});
			}else{
				if (repeat > 0){
					res.writeHead(301, {
						'Location':'http://localhost:4444/followRedirects?' + --repeat
					});
				}else{
					res.writeHead(301, {
						'Location':'http://localhost:4444/redirected'
					});
				}

			}
			res.end();
		},
		"/redirected":function(req, res){
			var message={"redirected":++this.redirectCount};
			res.writeHead(200, {
				'Content-Type' : 'application/json; charset=utf-8'
			});
			res.write(JSON.stringify(message));
			res.end();
		}

	},
	"sleep" : function(ms) {

		var stop = new Date().getTime();
		while (new Date().getTime() < stop + ms) {
			;
		}
	},
	"redirectCount":0,
	"redirectLimit":10

};

// Create an HTTP server
this.server = http.createServer(function(req, res) {
	// console.log("[SERVER] req.url", req.url);
	RouteManager.findRoute(req, res);
});

exports.baseURL = "http://localhost:4444";

exports.listen = function() {
	this.server.listen.apply(this.server, arguments);
};

exports.close = function(callback) {
	this.server.close(callback);
};

exports.on = function(event, cb) {
	this.server.on.apply(this.server, event, cb);
};
