var http = require('http');
var fs   = require('fs');

var blacklist = [];
var iplist    = [];

fs.watchFile('./blacklist', function(c,p) { update_blacklist(); });
fs.watchFile('./iplist', function(c,p) { update_iplist(); });

function update_blacklist() {
  console.log("Updating blacklist.");
  blacklist = fs.readFileSync('./blacklist', {encoding: 'utf-8'}).split('\n')
              .filter(function(rx) { return rx.length })
              .map(function(rx) { return RegExp(rx) });
}

function update_iplist() {
  console.log("Updating iplist.");
  iplist = fs.readFileSync('./iplist', {encoding: 'utf-8'}).split('\n')
           .filter(function(rx) { return rx.length });
}

function ip_allowed(ip) {
  for (i in iplist) {
    if (iplist[i] == ip) {
      return true;
    }
  }
  return false;
}

function host_allowed(host) {
  for (i in blacklist) {
    if (blacklist[i].test(host)) {
      return false;
    }
  }
  return true;
}

function deny(response, msg) {
  response.writeHead(401);
  response.write(msg);
  response.end();
}

http.createServer(function(request, response) {
  var ip = request.connection.remoteAddress;
  if (!ip_allowed(ip)) {
    msg = "IP " + ip + " is not allowed to use this proxy";
    deny(response, msg);
    console.log(msg);
    return;
  }

  if (!host_allowed(request.url)) {
    msg = "Host " + request.url + " has been denied by proxy configuration";
    deny(response, msg);
    console.log(msg);
    return;
  }

  console.log(ip + ": " + request.method + " " + request.url);
  var agent = new http.Agent({ host: request.headers['host'], port: 80, maxSockets: 1 });
  var proxy_request = http.request({
    host: request.headers['host'],
    port: 80,
    method: request.method,
    path: request.url,
    headers: request.headers,
    agent: agent
  });
  proxy_request.addListener('response', function(proxy_response) {
    proxy_response.addListener('data', function(chunk) {
      response.write(chunk, 'binary');
    });
    proxy_response.addListener('end', function() {
      response.end();
    });
    response.writeHead(proxy_response.statusCode, proxy_response.headers);
  });
  request.addListener('data', function(chunk) {
    proxy_request.write(chunk, 'binary');
  });
  request.addListener('end', function() {
    proxy_request.end();
  });
}).listen(8080);

update_blacklist();
update_iplist();