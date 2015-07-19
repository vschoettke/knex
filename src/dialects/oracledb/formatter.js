'use strict';

var inherits = require('inherits');
var assign = require('lodash/object/assign');
var Formatter = require('../../formatter');
var ReturningHelper = require('./utils').ReturningHelper;

function OracleDb_Formatter(client) {
  Formatter.call(this, client);
}
inherits(OracleDb_Formatter, Formatter);

assign(OracleDb_Formatter.prototype, {

  alias: function(first, second) {
    return first + ' ' + second;
  },

  parameter: function(value, notSetValue) {
    // Returning helper uses always ROWID as string
    if (value instanceof ReturningHelper && this.client.driver) {
      var oracledb = this.client.driver;
      value = { type: oracledb.STRING, dir: oracledb.BIND_OUT};
    }
    else if (typeof value === 'boolean') {
      value = value ? 1 : 0;
    }
    return Formatter.prototype.parameter.call(this, value, notSetValue);
  }
});

module.exports = OracleDb_Formatter;