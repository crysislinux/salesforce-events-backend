var express = require('express');
var nforce = require('nforce');
var env = require('../config/env')
var router = express.Router();
var fs = require('fs');
var changeCase = require('change-case')

/**
 * convert param attr names to salesforce names
 * @param  {object} bodyParams
 * @return {object} converted params
 *
 * @example {'firstName': 'Luo'} ==> {'First_Name__c': 'Luo'}
 */
function mapNameToSalseforce(bodyParams) {
  var mapped = {};
  for(var attr in bodyParams) {
    if (bodyParams.hasOwnProperty(attr)) {
      var titleCase = changeCase.titleCase(attr);
      var name = titleCase.replace(' ', '_');
      var suffix = name.substr(0, 8) === 'Sessions' ? 'r' : 'c';
      var forceName = [name, '__', suffix].join('');
      mapped[forceName] = bodyParams[attr];
    }
  }

  return mapped;
}

function checkBody(req) {
  req.checkBody({
    'sessions': {
      notEmpty: true,
      isArray: {
        errorMessage: 'Must be an array',
      },
      isUniqeArray: {
        errorMessage: 'A session can only include once',
      },
      errorMessage: 'Invalid Sessions',
    },
    'firstName': {
      notEmpty: true,
      isLength: {
        options: [{ min: 2, max: 512 }],
        errorMessage: 'Must be between 2 and 9999 chars long',
      },
      errorMessage: 'Invalid First Name',
    },
    'lastName': {
      notEmpty: true,
      isLength: {
        options: [{ min: 2, max: 512 }],
        errorMessage: 'Must be between 2 and 512 chars long',
      },
      errorMessage: 'Invalid Last Name',
    },
    'email': {
      notEmpty: true,
      isEmail: {
        errorMessage: 'Invalid Email',
      }
    },
    'phone': {
      notEmpty: true,
    },
    'company': {
      notEmpty: true,
    },
    'event': {
      notEmpty: true,
    }
  });
}

var attendeeAttrs = ['First_Name__c', 'Last_Name__c', 'Email__c', 'Phone__c', 'Company__c', 'Event__c'];
function buildAttendeeSObject(params) {
  // the content in bodyParams is ensured by checkBody, so we don't need to check again.
  var attendee = nforce.createSObject('Attendee__c');
  attendeeAttrs.forEach(function(attr) {
    attendee.set(attr, params[attr]);
  });
  return attendee;
}

function buildAttendeeSessionsSObject(Attendee__c, Sessions__r) {
  // the content in bodyParams is ensured by checkBody, so we don't need to check again.
  var atses = [];
  Sessions__r.forEach(function(Session__c) {
    var atse = nforce.createSObject('Attendee_Session__c');
    atse.set('Attendee__c', Attendee__c);
    atse.set('Session__c', Session__c);
    atses.push(atse);
  });

  return atses;
}

function readAddTicketsMessage(error) {
  if (!error.body || !error.body.hasErrors || !error.body.results) {
    return error;
  }

  for (var i = 0; i < error.body.results.length; i++) {
    var item = error.body.results[i];
    var errors = item.errors;
    for (var j = 0; j < errors.length; j++) {
      if (errors[j] && errors[j].message) {
        return new Error(errors[j].message);
      }
    }
  }

  return error;
}

function formatValidationErrors(errors) {
  var message = [];
  errors.forEach(function(error) {
    var readableName = changeCase.titleCase(error.param);
    message.push(readableName + ' - ' + error.msg);
  })
  return message;
}

router.post('/', function(req, res, next) {
  checkBody(req);
  var errors = req.validationErrors();
  if (errors) {
    res.status(400);
    res.json({
      message: formatValidationErrors(errors),
    });
    return;
  }

  var params = mapNameToSalseforce(req.body)

  var org = req.nforceOrg;
  var attendee = buildAttendeeSObject(params);
  org.insert({ sobject: attendee }, function(err, resp){
    if(!err) {
      var Attendee__c = resp.id;
      attendee.set('Id', Attendee__c);
      var atses = buildAttendeeSessionsSObject(Attendee__c, params.Sessions__r);
      org.insertMulti({ sobjects: atses }, function(err, resp) {
        if (!err) {
          if (resp.hasErrors) {
            res.status(400);
            next(new Error("Cannot add the attendee to the sessions"));
          } else {
            res.json(resp);
          }
        } else {
          org.delete({ sobject:  attendee})
          var formattedError = readAddTicketsMessage(err);
          next(formattedError);
        }
      });
    } else {
      next(err);
    }
  });
});

module.exports = router;
