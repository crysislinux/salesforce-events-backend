var jsonServer = require('json-server')
var delay = require('express-delay');
var server = jsonServer.create()
var router = jsonServer.router('fakedb/db.json')
var middlewares = jsonServer.defaults()

var port = 3002;
var loginToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEiLCJ1c2VybmFtZSI6InRlc3QifQ.qDaF8t8YJEf7GT-oyzhOJg2VnUooosPpWyTzDWYf6C4';

// delay 0.5 sec to emulate network latency
server.use(delay(500));

// Set default middlewares (logger, static, cors and no-cache)
server.use(middlewares)

// Add custom routes before JSON Server router
server.post('/login', function (req, res) {
  res.json({token: loginToken});
})

// Use default router
server.use(router)
server.listen(port, function (error) {
  if (error) {
    console.error(error);
  } else {
    console.info('==> 🌎  JSON Server is running on port %s', port);
  }
})
