# REST Client for Node.js
[![npm version](https://badge.fury.io/js/node-rest-client.svg)](https://www.npmjs.com/package/node-rest-client)
[![Build Status](https://travis-ci.org/olalonde/node-rest-client.svg?branch=master)](https://travis-ci.org/olalonde/node-rest-client)

[![NPM](https://nodei.co/npm/node-rest-client.png?downloads=true)](https://nodei.co/npm/node-rest-client.png?downloads=true)

## Features

Allows connecting to any API REST and get results as js Object. The client has the following features:

- Transparent HTTP/HTTPS connection to remote API sites.
- Allows simple HTTP basic authentication.
- Allows most common HTTP operations: GET, POST, PUT, DELETE, PATCH or any other method through custom connect method
- Allows creation of custom HTTP Methods (PURGE, etc.)
- Direct or through proxy connection to remote API sites.
- Register remote API operations as own client methods, simplifying reuse.
- Dynamic path and query parameters and request headers.
- Improved Error handling mechanism (client or specific request)
- Added support for compressed responses: gzip and deflate
- Added support for follow redirects thanks to great [follow-redirects](https://www.npmjs.com/package/follow-redirects) package
- Added support for custom request serializers (json,xml and url-encoded included by default)
- Added support for custom response parsers (json and xml included by default)



## Installation

$ npm install node-rest-client

## Usages

### Simple HTTP GET

Client has two ways to call a REST service: direct or using registered methods

```javascript
var Client = require('node-rest-client').Client;

var client = new Client();

// direct way
client.get("http://remote.site/rest/xml/method", function (data, response) {
	// parsed response body as js object
	console.log(data);
	// raw response
	console.log(response);
});

// registering remote methods
client.registerMethod("jsonMethod", "http://remote.site/rest/json/method", "GET");

client.methods.jsonMethod(function (data, response) {
	// parsed response body as js object
	console.log(data);
	// raw response
	console.log(response);
});
```

### HTTP POST 

POST, PUT or PATCH method invocation are configured like GET calls with the difference that you have to set "Content-Type" header in args passed to client method invocation:

```javascript
//Example POST method invocation
var Client = require('node-rest-client').Client;

var client = new Client();

// set content-type header and data as json in args parameter
var args = {
	data: { test: "hello" },
	headers: { "Content-Type": "application/json" }
};

client.post("http://remote.site/rest/xml/method", args, function (data, response) {
	// parsed response body as js object
	console.log(data);
	// raw response
	console.log(response);
});

// registering remote methods
client.registerMethod("postMethod", "http://remote.site/rest/json/method", "POST");

client.methods.postMethod(args, function (data, response) {
	// parsed response body as js object
	console.log(data);
	// raw response
	console.log(response);
});
```
If no "Content-Type" header is set as client arg POST,PUT and PATCH methods will not work properly.


### Passing args to registered methods

You can pass diferents args to registered methods, simplifying reuse: path replace parameters, query parameters, custom headers 

```javascript
var Client = require('node-rest-client').Client;

// direct way
var client = new Client();

var args = {
	data: { test: "hello" }, // data passed to REST method (only useful in POST, PUT or PATCH methods)
	path: { "id": 120 }, // path substitution var
	parameters: { arg1: "hello", arg2: "world" }, // this is serialized as URL parameters
	headers: { "test-header": "client-api" } // request headers
};


client.get("http://remote.site/rest/json/${id}/method", args,
	function (data, response) {
		// parsed response body as js object
		console.log(data);
		// raw response
		console.log(response);
	});


// registering remote methods
client.registerMethod("jsonMethod", "http://remote.site/rest/json/${id}/method", "GET");


/* this would construct the following URL before invocation
 *
 * http://remote.site/rest/json/120/method?arg1=hello&arg2=world
 *
 */
client.methods.jsonMethod(args, function (data, response) {
	// parsed response body as js object
	console.log(data);
	// raw response
	console.log(response);
});
```

You can even use path placeholders in query string in direct connection:

```javascript
var Client = require('node-rest-client').Client;

// direct way
var client = new Client();

var args = {
	path: { "id": 120, "arg1": "hello", "arg2": "world" },	
	headers: { "test-header": "client-api" }
};

client.get("http://remote.site/rest/json/${id}/method?arg1=${arg1}&arg2=${arg2}", args,
	function (data, response) {
		// parsed response body as js object
		console.log(data);
		// raw response
		console.log(response);
	});
```

###  HTTP POST and PUT methods

To send data to remote site using POST or PUT methods, just add a data attribute to args object:

```javascript
var Client = require('node-rest-client').Client;

// direct way
var client = new Client();

var args = {
	path: { "id": 120 },
	parameters: { arg1: "hello", arg2: "world" },
	headers: { "test-header": "client-api" },
	data: "<xml><arg1>hello</arg1><arg2>world</arg2></xml>"
};

client.post("http://remote.site/rest/xml/${id}/method", args, function (data, response) {
	// parsed response body as js object
	console.log(data);
	// raw response
	console.log(response);
});

// registering remote methods
client.registerMethod("xmlMethod", "http://remote.site/rest/xml/${id}/method", "POST");


client.methods.xmlMethod(args, function (data, response) {
	// parsed response body as js object
	console.log(data);
	// raw response
	console.log(response);
});

// posted data can be js object
var args_js = {
	path: { "id": 120 },
	parameters: { arg1: "hello", arg2: "world" },
	headers: { "test-header": "client-api" },
	data: { "arg1": "hello", "arg2": 123 }
};

client.methods.xmlMethod(args_js, function (data, response) {
	// parsed response body as js object
	console.log(data);
	// raw response
	console.log(response);
});
```

### Request/Response configuration

It's also possible to configure each request and response, passing its configuration as an
additional argument in method call.

```javascript
var client = new Client();

// request and response additional configuration
var args = {
	path: { "id": 120 },
	parameters: { arg1: "hello", arg2: "world" },
	headers: { "test-header": "client-api" },
	data: "<xml><arg1>hello</arg1><arg2>world</arg2></xml>",
	requestConfig: {
		timeout: 1000, //request timeout in milliseconds
		noDelay: true, //Enable/disable the Nagle algorithm
		keepAlive: true, //Enable/disable keep-alive functionalityidle socket.
		keepAliveDelay: 1000 //and optionally set the initial delay before the first keepalive probe is sent
	},
	responseConfig: {
		timeout: 1000 //response timeout
	}
};


client.post("http://remote.site/rest/xml/${id}/method", args, function (data, response) {
	// parsed response body as js object
	console.log(data);
	// raw response
	console.log(response);
});
```
If you want to handle timeout events both in the request and in the response just add a new "requestTimeout"
or "responseTimeout" event handler to clientRequest returned by method call.

```javascript
var client = new Client();

// request and response additional configuration
var args = {
	path: { "id": 120 },
	parameters: { arg1: "hello", arg2: "world" },
	headers: { "test-header": "client-api" },
	data: "<xml><arg1>hello</arg1><arg2>world</arg2></xml>",
	requestConfig: {
		timeout: 1000, //request timeout in milliseconds
		noDelay: true, //Enable/disable the Nagle algorithm
		keepAlive: true, //Enable/disable keep-alive functionalityidle socket.
		keepAliveDelay: 1000 //and optionally set the initial delay before the first keepalive probe is sent
	},
	responseConfig: {
		timeout: 1000 //response timeout
	}
};


var req = client.post("http://remote.site/rest/xml/${id}/method", args, function (data, response) {
	// parsed response body as js object
	console.log(data);
	// raw response
	console.log(response);
});

req.on('requestTimeout', function (req) {
	console.log('request has expired');
	req.abort();
});

req.on('responseTimeout', function (res) {
	console.log('response has expired');

});

//it's usefull to handle request errors to avoid, for example, socket hang up errors on request timeouts
req.on('error', function (err) {
	console.log('request error', err);
});
```

### Setup client to trust self-signed certificate with custom CA chain
In Internet mostly recommend solution to handle self-signed certificate is to just disable verification of server.
**NEVER DO THAT IN PRODUCTION!**
You can do that only for development purpose - never in production because it puts great security risk on your business.

However if you are connecting to a known server using self-signed certificate or a company server signed with corporate CA you can easily setup client to trust them and being secured in same moment.
So for example certificate chain:

```
+-- root-CA (self-signed)
|   +-- department-CA (singed with root-CA)
|       +-- domain (signed with department-CA)
```

a solution is as follow:

```javascript
var fs = required('fs');
var trustedCertificates = [
fs.readFileSync('/PATH/TO/DOMAIN/CERTIFICATE'),
fs.readFileSync('/PATH/TO/DEPARTMENT/CA'),
fs.readFileSync('/PATH/TO/ROOT/CA')
];

var options = {
	connection: {
		ca: trustedCertificates
	}
};
var client = new Client(options);
```

Note that for readability format of certificate are skipped as multiple ones are supported.

### Follows Redirect
Node REST client follows redirects by default to a maximum of 21 redirects, but it's also possible to change follows redirect default config in each request done by the client
```javascript
var client = new Client();

// request and response additional configuration
var args = {
	requestConfig: {
		followRedirects:true,//whether redirects should be followed(default,true) 
		maxRedirects:10//set max redirects allowed (default:21)
	},
	responseConfig: {
		timeout: 1000 //response timeout
	}
};

```


### Response Parsers

You can add your own response parsers to client, as many as you want. There are 2 parser types:

- _**Regular parser**_: First ones to analyze responses. When a response arrives it will pass through all regular parsers, first parser whose `match` method return true will be the one to process the response. there can be as many regular parsers as you need. you can delete and replace regular parsers when it'll be needed.

- _**Default parser**_: When no regular parser has been able to process the response, default parser will process it, so it's guaranteed that every response is processed. There can be only one default parser and cannot be deleted but it can be replaced adding a parser with `isDefault` attribute to true.

Each parser - regular or default- needs to follow some conventions:

* Must be and object

* Must have the following attributes:

    * `name`: Used to identify parser in parsers registry
    
    *  `isDefault`: Used to identify parser as regular parser or default parser. Default parser is applied when client cannot find any regular parser that match  to received response

* Must have the following methods:

    * `match(response)`: used to find which parser should be used with a response. First parser found will be the one to be used. Its arguments are:
        1. `response`:`http.ServerResponse`: you can use any argument available in node ServerResponse, for example `headers`

    * `parse(byteBuffer,nrcEventEmitter,parsedCallback)` : this method is where response body should be parsed and passed to client request callback. Its arguments are:
        1. `byteBuffer`:`Buffer`: Raw response body that should be parsed as js object or whatever you need 
        2. `nrcEventEmitter`:`client event emitter`: useful to dispatch events during parsing process, for example error events
        3. `parsedCallback`:`function(parsedData)`: this callback should be invoked when parsing process has finished to pass parsed data to request callback.

Of course any other method or attribute needed for parsing process can be added to parser.

```javascript
// no "isDefault" attribute defined 
var invalid = {
			   "name":"invalid-parser",
			   "match":function(response){...},
			   "parse":function(byteBuffer,nrcEventEmitter,parsedCallback){...}
			 };

var validParser = {
				   "name":"valid-parser",
				   "isDefault": false,
			   	   "match":function(response){...},
			       "parse":function(byteBuffer,nrcEventEmitter,parsedCallback){...},
			       // of course any other args or methods can be added to parser
			       "otherAttr":"my value",
			       "otherMethod":function(a,b,c){...}
				  };			

function OtherParser(name){
	   this.name: name,
	   this.isDefault: false,
	   this.match=function(response){...};
	   this.parse:function(byteBuffer,nrcEventEmitter,parsedCallback){...};
		
}

var instanceParser = new OtherParser("instance-parser");

//valid parser complete example

client.parsers.add({
						"name":"valid-parser",
						"isDefault":false,
						"match":function(response){
							// only match to responses with  a test-header equal to "hello world!"
							return response.headers["test-header"]==="hello world!";
						},							
						"parse":function(byteBuffer,nrcEventEmitter,parsedCallback){
							// parsing process
							var parsedData = null;
							try{
								parsedData = JSON.parse(byteBuffer.toString());
								parsedData.parsed = true;

								// emit custom event
								nrcEventEmitter('parsed','data has been parsed ' + parsedData);

								// pass parsed data to client request method callback
								parsedCallback(parsedData);
							}catch(err){
								nrcEmitter('error',err);
							};						

						});

```

By default and to maintain backward compatibility, client comes with 2 regular parsers and 1 default parser:

- _**JSON parser**_: it's named 'JSON' in parsers registry and processes responses to js object. As in previous versions you can change content-types used to match responses by adding a  "mimetypes" attribute to client options.

```javascript
var options = {
				mimetypes: {
						json: ["application/json", "application/my-custom-content-type-for-json;charset=utf-8"]
						
					}
				};

var client = new Client(options);				

```

- _**XML parser**_: it's named 'XML' in parsers registry and processes responses returned as XML documents to js object. As in previous versions you can change content-types used to match responses by adding a  "mimetypes" attribute to client options.

```javascript
var options = {
				mimetypes: {
						xml: ["application/xml", "application/my-custom-content-type-for-xml"]						
					}
				};

var client = new Client(options);

```

Additionally in this parser there's an attribute "options" where you can customize xml2js parser options. Please refer to [xml2js package](https://www.npmjs.com/package/xml2js) for valid parser options.

```javascript

var client = new Client();

client.parsers.find("XML").options= {"explicitArray":false, "ignoreAttrs":true};

```


- _**Default Parser**_: return responses as is, without any adittional processing.

#### Parser Management

Client can manage parsers through the following parsers namespace methods:

* `add(parser)`: add a regular or default parser (depending on isDefault attribute value) to parsers registry. If you add a regular parser with the same name as an existing one, it will be overwritten
	
	1. `parser`: valid parser object. If invalid parser is added an 'error' event is dispatched by client.

* `remove(parserName)`: removes a parser from parsers registry. If not parser found an 'error' event is dispatched by client.
	
	1. `parserName`: valid parser name previously added.

* `find(parserName)`: find and return a parser searched by its name. If not parser found an 'error' event is dispatched by client.
	
	1. `parserName`: valid parser name previously added.

* `getAll()`: return a collection of current regular parsers.

* `getDefault()`: return the default parser used to process responses that doesn't match with any regular parser.

* `clean()`: clean regular parser registry. default parser is not afected by this method.

```javascript
var client = new Client();

client.parsers.add({
				   "name":"valid-parser",
				   "isDefault": false,
			   	   "match":function(response){...},
			       "parse":function(byteBuffer,nrcEventEmitter,parsedCallback){...},
			       // of course any other args or methods can be added to parser
			       "otherAttr":"my value",
			       "otherMethod":function(a,b,c){...}
				  });

var parser = client.parsers.find("valid-parser");

var defaultParser = client.parsers.getDefault();

var regularParsers = client.parsers.getAll();	

client.parsers.clean();			  


```


### Request Serializers

You can add your own request serializers to client, as many as you want. There are 2 serializer types:

- _**Regular serializer**_: First ones to analyze requests. When a request is sent it will pass through all regular serializers, first serializer whose `match` method return true will be the one to process the request. there can be as many regular serializers as you need. you can delete and replace regular serializers when it'll be needed.

- _**Default serializer**_: When no regular serializer has been able to process the request, default serializer will process it, so it's guaranteed that every request is processed. There can be only one default serializer and cannot be deleted but it can be replaced adding a serializer with `isDefault` attribute to true.

Each serializer - regular or default- needs to follow some conventions:

* Must be and object

* Must have the following attributes:

    * `name`: Used to identify serializer in serializers registry
    
    *  `isDefault`: Used to identify serializer as regular serializer or default serializer. Default serializer is applied when client cannot find any regular serializer that match  to sent request

* Must have the following methods:

    * `match(request)`: used to find which serializer should be used with a request. First serializer found will be the one to be used. Its arguments are:
        1. `request`:`options passed to http.ClientRequest`: any option passed to a request through client options or request args, for example `headers`

    * `serialize(data,nrcEventEmitter,serializedCallback)` : this method is where request body should be serialized before passing to client request callback. Its arguments are:
        1. `data`:`args data attribute`: Raw request body as is declared in args request attribute that should be serialized.

        2. `nrcEventEmitter`:`client event emitter`: useful to dispatch events during serialization process, for example error events
        
        3. `serializedCallback`:`function(serializedData)`: this callback should be invoked when serialization process has finished to pass serialized data to request callback.

Of course any other method or attribute needed for serialization process can be added to serializer.

```javascript
// no "isDefault" attribute defined 
var invalid = {
			   "name":"invalid-serializer",
			   "match":function(request){...},
			   "serialize":function(data,nrcEventEmitter,serializedCallback){...}
			 };

var validserializer = {
				   "name":"valid-serializer",
				   "isDefault": false,
			   	   "match":function(request){...},
			       "serialize":function(data,nrcEventEmitter,serializedCallback){...},
			       // of course any other args or methods can be added to serializer
			       "otherAttr":"my value",
			       "otherMethod":function(a,b,c){...}
				  };			

function OtherSerializer(name){
	   this.name: name,
	   this.isDefault: false,
	   this.match=function(request){...};
	   this.serialize:function(data,nrcEventEmitter,serializedCallback){...};
		
}

var instanceserializer = new OtherSerializer("instance-serializer");

// valid serializer complete example

client.serializers.add({
						"name":"example-serializer",
						"isDefault":false,
						"match":function(request){
							// only match to requests with  a test-header equal to "hello world!"
							return request.headers["test-header"]==="hello world!";
						},							
						"serialize":function(data,nrcEventEmitter,serializedCallback){
							// serialization process
							var serializedData = null;

							if (typeof data === 'string'){
								serializedData = data.concat(" I'm serialized!!");
							}else if (typeof data === 'object'){
								serializedData = data;
								serializedData.state = "serialized"
								serializedData = JSON.stringify(serializedData);
							}

							nrcEventEmitter('serialized','data has been serialized ' + serializedData);
							// pass serialized data to client to be sent to remote API
							serializedCallback(serializedData);

						}
	
})


```

By default client comes with 3 regular serializers and 1 default serializer:

- _**JSON serializer**_: it's named 'JSON' in serializers registry and serialize js objects to its JSON string representation. It will match any request sent  **exactly** with the following content types: "application/json","application/json;charset=utf-8"


- _**XML serializer**_: it's named 'XML' in serializers registry and serialize js objects to its XML string representation. It will match any request sent  **exactly** with the following content types: "application/xml","application/xml;charset=utf-8","text/xml","text/xml;charset=utf-8"

Additionally in this parser there's an attribute "options" where you can customize xml2js serializer options. Please refer to [xml2js package](https://www.npmjs.com/package/xml2js) for valid builder options.

```javascript
var client = new Client();

client.serializers.find("XML").options={"renderOpts":{"pretty": true }};

```

- _**URL ENCODE serializer**_: it's named 'FORM-ENCODED' in serializers registry and serialize js objects to its FORM ENCODED string representation. It will match any request sent  **exactly** with the following content types: "application/x-www-form-urlencoded","multipart/form-data","text/plain"


- _**Default serializer**_:  serialize request to its string representation, applying toString() method to data parameter.

#### serializer Management

Client can manage serializers through the following serializers namespace methods:

* `add(serializer)`: add a regular or default serializer (depending on isDefault attribute value) to serializers registry.If you add a regular serializer with the same name as an existing one, it will be overwritten
	
	1. `serializer`: valid serializer object. If invalid serializer is added an 'error' event is dispatched by client.

* `remove(serializerName)`: removes a serializer from serializers registry. If not serializer found an 'error' event is dispatched by client.
	
	1. `serializerName`: valid serializer name previously added.

* `find(serializerName)`: find and return a serializer searched by its name. If not serializer found an 'error' event is dispatched by client.
	
	1. `serializerName`: valid serializer name previously added.

* `getAll()`: return a collection of current regular serializers.

* `getDefault()`: return the default serializer used to process requests that doesn't match with any regular serializer.

* `clean()`: clean regular serializer registry. default serializer is not afected by this method.


```javascript
var client = new Client();

client.serializers.add({
						"name":"valid-serializer",
						"isDefault":false,
						"match":function(request){
							// only match to requests with  a test-header equal to "hello world!"
							return request.headers["test-header"]==="hello world!";
						},							
						"serialize":function(data,nrcEventEmitter,serializedCallback){
							// serialization process
							var serializedData = null;

							if (typeof data === 'string'){
								serializedData = data.concat(" I'm serialized!!");
							}else if (typeof data === 'object'){
								serializedData = data;
								serializedData.state = "serialized"
								serializedData = JSON.stringify(serializedData);
							}

							nrcEventEmitter('serialized','data has been serialized ' + serializedData);
							// pass serialized data to client to be sent to remote API
							serializedCallback(serializedData);

						});

var serializer = client.serializers.find("valid-serializer");

var defaultParser = client.serializers.getDefault();

var regularSerializers = client.serializers.getAll();	

client.serializers.clean();			  


```

### Connect through proxy

Just pass proxy configuration as option to client.


```javascript
var Client = require('node-rest-client').Client;

// configure proxy
var options_proxy = {
	proxy: {
		host: "proxy.foo.com",
		port: 8080,
		user: "proxyuser",
		password: "123",
		tunnel: true
	}
};

var client = new Client(options_proxy);
```

client has 2 ways to connect to target site through a proxy server: tunnel or direct request, the first one is the default option
so if you want to use direct request you must set tunnel off.

```javascript
var Client = require('node-rest-client').Client;

// configure proxy
var options_proxy = {
	proxy: {
		host: "proxy.foo.com",
		port: 8080,
		user: "proxyuser",
		password: "123",
		tunnel: false // use direct request to proxy
	}
};

var client = new Client(options_proxy);
```



### Basic HTTP auth

Just pass username and password or just username, if no password is required by remote site, as option to client. Every request done with the client will pass username and password or just username if no password is required as basic authorization header.

```javascript
var Client = require('node-rest-client').Client;

// configure basic http auth for every request
var options_auth = { user: "admin", password: "123" };

var client = new Client(options_auth);
```

### Options parameters

You can pass the following args when creating a new client:

```javascript
var options = {
	// proxy configuration
	proxy: {
		host: "proxy.foo.com", // proxy host
		port: 8080, // proxy port
		user: "ellen", // proxy username if required
		password: "ripley" // proxy pass if required
	},
	// aditional connection options passed to node http.request y https.request methods 
	// (ie: options to connect to IIS with SSL)	
	connection: {
		secureOptions: constants.SSL_OP_NO_TLSv1_2,
		ciphers: 'ECDHE-RSA-AES256-SHA:AES256-SHA:RC4-SHA:RC4:HIGH:!MD5:!aNULL:!EDH:!AESGCM',
		honorCipherOrder: true
	},
	// will replace content-types used to match responses in JSON and XML parsers
	mimetypes: {
		json: ["application/json", "application/json;charset=utf-8"],
		xml: ["application/xml", "application/xml;charset=utf-8"]
	},
	user: "admin", // basic http auth username if required
	password: "123", // basic http auth password if required
	requestConfig: {
		timeout: 1000, //request timeout in milliseconds
		noDelay: true, //Enable/disable the Nagle algorithm
		keepAlive: true, //Enable/disable keep-alive functionalityidle socket.
		keepAliveDelay: 1000 //and optionally set the initial delay before the first keepalive probe is sent
	},
	responseConfig: {
		timeout: 1000 //response timeout
	}
};
```
Note that requestConfig and responseConfig options if set on client instantiation apply to all of its requests/responses
and is only overriden by request or reponse configs passed as args in method calls.


### Managing Requests

Each REST method invocation returns a request object with specific request options and error, requestTimeout and responseTimeout event handlers.

```javascript
var Client = require('node-rest-client').Client;

var client = new Client();

var args = {
	requesConfig: { timeout: 1000 },
	responseConfig: { timeout: 2000 }
};

// direct way
var req1 = client.get("http://remote.site/rest/xml/method", args, function (data, response) {
	// parsed response body as js object
	console.log(data);
	// raw response
	console.log(response);
});

// view req1 options		
console.log(req1.options);


req1.on('requestTimeout', function (req) {
	console.log("request has expired");
	req.abort();
});

req1.on('responseTimeout', function (res) {
	console.log("response has expired");

});


// registering remote methods
client.registerMethod("jsonMethod", "http://remote.site/rest/json/method", "GET");

var req2 = client.methods.jsonMethod(function (data, response) {
	// parsed response body as js object
	console.log(data);
	// raw response
	console.log(response);
});

// handling specific req2 errors
req2.on('error', function (err) {
	console.log('something went wrong on req2!!', err.request.options);
});
```

###  Error Handling

 Now you can handle error events in two places: on client or on each request.

```javascript
var client = new Client(options_auth);

// handling request error events
client.get("http://remote.site/rest/xml/method", function (data, response) {
	// parsed response body as js object
	console.log(data);
	// raw response
	console.log(response);
}).on('error', function (err) {
	console.log('something went wrong on the request', err.request.options);
});

// handling client error events
client.on('error', function (err) {
	console.error('Something went wrong on the client', err);
});
```

**NOTE:** _Since version 0.8.0 node does not contain node-waf anymore. The node-zlib package which node-rest-client make use of, depends on node-waf.Fortunately since version 0.8.0 zlib is a core dependency of node, so since version 1.0 of node-rest-client the explicit dependency to "zlib" has been removed from package.json. therefore if you are using a version below 0.8.0 of node please use a versión below 1.0.0 of "node-rest-client". _ 

