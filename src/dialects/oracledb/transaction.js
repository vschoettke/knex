'use strict';

var inherits = require('inherits');
var Promise = require('../../promise');
var Transaction = require('../../transaction');
var assign = require('lodash/object/assign');
var debugTx = require('debug')('knex:tx');

function OracleDb_Transaction(client, container, config, outerTx) {
  Transaction.call(this, client, container, config, outerTx);
}
inherits(OracleDb_Transaction, Transaction);

assign(OracleDb_Transaction.prototype, {

  // disable autocommit to allow correct behavior (default is true)
  begin: function() {
    return Promise.resolve();
  },

  commit: function(conn, value) {
    this._completed = true;
    return conn.commit(function (err) {
      if (err) {
        this._rejecter(err);
        return;
      }
      this._resolver();
    })
  },

  release: function(conn, value) {
    return this._resolver(value);
  },

  rollback: function(conn, err) {
    this._completed = true;
    debugTx('%s: rolling back', this.txid);
    return conn.rollback(function (errInternal) {
      if (err) {
        this._rejecter(errInternal);
        return;
      }
      this._rejecter(err);
    });
  },

  acquireConnection: function(config) {
    var t = this;
    return Promise.try(function() {
      return config.connection || t.client.acquireConnection();
    }).tap(function(connection) {
      if (!t.outerTx) {
        // connection.setAutoCommit(false);
      }
    }).disposer(function(connection) {
      debugTx('%s: releasing connection', t.txid);
      // connection.setAutoCommit(true);
      if (!config.connection) {
        t.client.releaseConnection(connection);
      } else {
        debugTx('%s: not releasing external connection', t.txid);
      }
    });
  }
});

module.exports = OracleDb_Transaction;
