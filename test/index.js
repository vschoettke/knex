/*global describe*/

'use strict';

global.sinon = require("sinon");

var chai = global.chai = require("chai");

chai.use(require("chai-as-promised"));
chai.use(require("sinon-chai"));
chai.should();

var Promise = global.testPromise = require('../lib/promise');
global.expect         = chai.expect;
global.AssertionError = chai.AssertionError;
global.Assertion      = chai.Assertion;
global.assert         = chai.assert;
global.d = new Date();

Promise.longStackTraces();

var knex = require('../knex');

var clients = {
  maria: {alias: 'mysql'},
  mysql: {},
  sqlite3: {},
  postgres: {},
  oracle: {}
};

describe('Unit tests', function() {
  Object.keys(clients).forEach(function (clientName) {
    var client = knex({client: clientName}).client;
    require('./unit/schema/' + (clients[clientName].alias || clientName))(client);
    require('./unit/query/builder')(function () { return new client.QueryBuilder(); }, clientName, clients[clientName].alias);
    require('./unit/quote/quote')(client, clientName, clients[clientName].alias);
  });
});

describe('Quote tests - default quote off', function() {
  Object.keys(clients).forEach(function (clientName) {
    var client = knex({client: clientName, quote: false}).client;
    client.initSchema();
    require('./unit/quote/quote_default_off')(client, clientName, clients[clientName].alias);
  });
});

// Integration Tests
describe('Integration Tests', function() {
  require('./integration')(this);
});
