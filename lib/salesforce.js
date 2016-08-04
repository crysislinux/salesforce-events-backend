var nforce = require('nforce');
var config = require('../config/env')
var salesforceConfig = config.salesforce;

function authenticate(callback) {
  var org = nforce.createConnection({
    clientId: salesforceConfig.clientId,
    clientSecret: salesforceConfig.clientSecret,
    redirectUri: salesforceConfig.redirectUri,
    mode: 'single',
    apiVersion: 'v37.0',
    autoRefresh: true,
  });

  org.authenticate({
    username: salesforceConfig.username,
    password: salesforceConfig.password,
    securityToken: salesforceConfig.securityToken,
  }, function(err, resp) {
    if (err) {
      callback(err);
    } else {
      callback(err, org);
    }
  })
}

module.exports = {
  authenticate: authenticate,
}
