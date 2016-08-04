/* eslint-disable */
var httpProxy = require('http-proxy');
var querystring = require('querystring');
var proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ignorePath: true
});

proxy.on('error', function(e) {
  console.log(e);
})

function removeRightSlash(str) {
  return str.endsWith('/') ? str.slice(0, -1) : str;
}

function getEndpoint(api) {
  var parts = api.split('|');
  return removeRightSlash(parts[0]);
}

function getAddress(api) {
  var parts = api.split('|');
  return parts[1];
}

function buildProxies(apis) {
  var proxies = {};

  for(var name in apis) {
    var endpoint = getEndpoint(apis[name]);
    var address = getAddress(apis[name]);
    console.log('endpoint: ' + endpoint, 'address: ' + address)
    proxies[endpoint] = (function (endpoint, address){
      return function(req, res) {
        var target = address + req.path.slice(endpoint.length);
        var query = querystring.stringify(req.query);
        if (query.length > 0) {
          target += '?' + query;
        }
        console.log('forwardTo: ' + target);
        proxy.web(req, res, { target: target })
      }
    }(endpoint, address))
  }

  return proxies;
}

function proxyToApi(proxies, req, res, next) {
  var path = req.path;
  for(var endpoint in proxies) {
    if (path.startsWith(endpoint)) {
      proxies[endpoint](req, res, next);
      return;
    }
  }

  next();
}

var ø = Object.create(null);

module.exports = function(apis){
  var proxies = buildProxies(apis);

  return proxyToApi.bind(ø, proxies);
}
