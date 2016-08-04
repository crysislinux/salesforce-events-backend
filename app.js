var express = require('express');
var logger = require('morgan');
var bodyParser = require('body-parser');
var expressValidator = require('express-validator');
var env = require('./config/env');
var router = require('./routes');
var salesforce = require('./lib/salesforce');
var nocache = require('./middleware/nocache');
var crossdomain = require('./middleware/crossdomain');

var app = express();
app.use(express.static(__dirname + '/client'));

app.use(logger('dev'));

var apis = [
  // '/api|http://localhost:3002',
]

var proxy = require('./proxy')(apis);

app.use(proxy);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(expressValidator({
  customValidators: {
    isArray: function(value) {
      return Array.isArray(value);
    },
    isUniqeArray: function(value) {
      if (!Array.isArray(value)) {
        return true;
      }
      var items = [];
      value.forEach(function(item) {
        if (items.indexOf(item) === -1) {
          items.push(item);
        }
      })
      return items.length === value.length;
    }
  }
}));

var nforceOrg = null;

app.use(function(req, res, next) {
  if (nforceOrg) {
    req.nforceOrg = nforceOrg;
    return next();
  }

  salesforce.authenticate(function(err, org) {
    if (err) {
      next(err);
    } else {
      nforceOrg = org;
      req.nforceOrg = nforceOrg;
      return next();
    }
  })
})

if (process.env.NODE_ENV !== 'production') {
  app.use(crossdomain);
}

app.use(nocache);

app.use('/api/events', router.events);
app.use('/api/tickets', router.tickets);

app.get('*', function(req, res, next) {
  res.sendFile("index.html", { root: __dirname + "/client" });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  console.log(JSON.stringify(err));
  res.status(err.status || err.statusCode || 500);
  res.json({
    message: err.message
  });
});


module.exports = app;
