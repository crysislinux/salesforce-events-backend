var express = require('express');
var env = require('../config/env')
var router = express.Router();
var fs = require('fs');
var changeCase = require('change-case');
var Promise = require("bluebird");

var eventAttrs = ['Id', 'Title__c', 'Start__c', 'End__c', 'Status__c', 'Registration_Limit__c', 'Remaining_Seats__c', 'Description__c'];
var sessionAttrs = ['Id', 'Title__c', 'Start__c', 'End__c', 'Status__c', 'Registration_Limit__c', 'Remaining_Seats__c'];

function formatAttrName(attr) {
    var cleaned = attr.toLowerCase().replace('__c', '');
    return changeCase.camelCase(cleaned);
}

function reassembleEvents(eventRecords) {
  var events = [];
  for(i = 0; i < eventRecords.length; i++) {
    var event = {};
    eventAttrs.forEach(function(attr) {
      var value = eventRecords[i].get(attr)
      if (attr === 'Description__c' && value) {
        value = value.replace(/c\.ap2\.content\.force\.com/g, 'crysislinux-developer-edition.ap2.force.com');
      }
      event[formatAttrName(attr)] = value;
    })
    var sessions__r = eventRecords[i].get('Sessions__r');
    var sessionRecords = (sessions__r && sessions__r.records) || [];
    var sessions = [];
    for(j = 0; j < sessionRecords.length; j++) {
      var session = {};
      sessionAttrs.forEach(function(attr) {
        session[formatAttrName(attr)] = sessionRecords[j][attr];
      })
      sessions.push(session);
    }
    event.sessions = sessions;
    events.push(event);
  }

  return events;
}

function queryList(org, limit, offset) {
  var query = 'SELECT ' + eventAttrs.join(', ')+
              ', (SELECT ' + sessionAttrs.join(', ') +
              ' FROM Event__c.Sessions__r' +
              " WHERE Status__c IN ('Open', 'Sold Out', 'Closed')" +
              ' ORDER BY CreatedDate DESC' +
              ')' +
              ' FROM Event__c' +
              " WHERE Status__c IN ('Open', 'Sold Out', 'Closed')" +
              ' ORDER BY CreatedDate DESC' +
              ' LIMIT ' + limit +
              ' OFFSET ' + offset;
  return org.query({ query: query });
}

function queryTotal(org) {
  var query = "SELECT count() FROM Event__c WHERE Status__c IN ('Open', 'Sold Out', 'Closed')";
  return org.query({ query: query });
}

router.get('/', function(req, res, next) {
  var org = req.nforceOrg;
  var limit = 9;
  var page = parseInt(req.query.page) || 1;
  var offset = (page - 1) * limit;
  var url = env.domain + '/api/events';

  Promise.props({
    list: queryList(org, limit, offset),
    total: queryTotal(org),
  })
  .then(function(resp) {
    var totalSize = resp.total.totalSize
    res.json({
      total: totalSize,
      records: reassembleEvents(resp.list.records),
      previous: page === 1 ? null : url + '?page=' + (page - 1),
      next: page * limit >= totalSize ? null : url + '?page=' + (page + 1),
    });
  })
  .catch(function(err) {
    next(err);
  });
});

router.get('/:id', function(req, res, next) {
  var org = req.nforceOrg;
  var query = 'SELECT ' + eventAttrs.join(', ')+
              ', (SELECT ' + sessionAttrs.join(', ') +
              ' FROM Event__c.Sessions__r' +
              " WHERE Status__c IN ('Open', 'Sold Out', 'Closed')" +
              ' ORDER BY CreatedDate DESC' +
              ')' +
              ' FROM Event__c' +
              " WHERE Status__c IN ('Open', 'Sold Out', 'Closed') AND Id = '"+ req.params.id + "' ";
  org.query({ query: query }, function(err, resp){
    if(!err) {
      var reassembled = reassembleEvents(resp.records)
      if (reassembled.length > 0) {
        res.json(reassembled[0]);
      } else {
        res.status(404);
        next(new Error('Event not found'));
      }
    } else {
      next(err);
    }
  });
});

module.exports = router;
