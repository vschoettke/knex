'use strict';

console.log("OracleDB Client");

// OracleDb Client
// -------
var _ = require('lodash');
var inherits = require('inherits');
var assign = require('lodash/object/assign');

var Formatter = require('./formatter');
var Client = require('../../client');
var Promise = require('../../promise');
var helpers = require('../../helpers');
var SqlString = require('../../query/string');

var Transaction = require('./transaction');
var QueryCompiler = require('./query/compiler');
var SchemaCompiler = require('./schema/compiler');
var ColumnBuilder = require('./schema/columnbuilder');
var ColumnCompiler = require('./schema/columncompiler');
var TableCompiler = require('./schema/tablecompiler');
var OracleQueryStream = require('./stream');
var ReturningHelper = require('./utils').ReturningHelper;

// Always initialize with the "QueryBuilder" and "QueryCompiler"
// objects, which extend the base 'lib/query/builder' and
// 'lib/query/compiler', respectively.
function Client_OracleDb(config) {
  Client.call(this, config);
}
inherits(Client_OracleDb, Client);

assign(Client_OracleDb.prototype, {

  dialect: 'oracledb',

  driverName: 'oracledb',

  _driver: function() {
    var Oracledb = require('oracledb');
    Oracledb.autoCommit = true;
    Oracledb.maxRows = Math.pow(2, 31) - 1; // maximum number of rows otherwise oracledb will crash
    Oracledb.outFormat = Oracledb.OBJECT;
    return Oracledb;
  },

  Transaction: Transaction,

  Formatter: Formatter,

  QueryCompiler: QueryCompiler,

  SchemaCompiler: SchemaCompiler,

  ColumnBuilder: ColumnBuilder,

  ColumnCompiler: ColumnCompiler,

  TableCompiler: TableCompiler,

  prepBindings: function(bindings) {
    return _.map(bindings, function(value) {
      // returning helper uses always ROWID as string
      if (value instanceof ReturningHelper && this.driver) {
        return new this.driver.OutParam(this.driver.OCCISTRING);
      }
      else if (typeof value === 'boolean') {
        return value ? 1 : 0;
      }
      else if (Buffer.isBuffer(value)) {
        return SqlString.bufferToString(value);
      }
      return value;
    }, this);
  },

  // Get a raw connection, called by the `pool` whenever a new
  // connection needs to be added to the pool.
  acquireRawConnection: function() {
    var client = this;
    return new Promise(function(resolver, rejecter) {
      client.driver.getConnection(client.connectionSettings,
        function(err, connection) {
          if (err) {
            return rejecter(err);
          }
          resolver(connection);
        });
    });
  },

  // Used to explicitly close a connection, called internally by the pool
  // when a connection times out or the pool is shutdown.
  destroyRawConnection: function(connection, cb) {
    connection.release(cb);
  },

  // Return the database for the Oracle client.
  database: function() {
    return this.connectionSettings.database;
  },

  // Position the bindings for the query.
  positionBindings: function(sql) {
    var questionCount = 0;
    return sql.replace(/\?/g, function() {
      questionCount += 1;
      return ':' + questionCount;
    });
  },

  _stream: function(connection, obj, stream, options) {
    obj.sql = this.positionBindings(obj.sql);
    return new Promise(function (resolver, rejecter) {
      stream.on('error', rejecter);
      stream.on('end', resolver);
      var queryStream = new OracleQueryStream(connection, obj.sql, obj.bindings, options);
      queryStream.pipe(stream);
    });
  },

  // Runs the query on the specified connection, providing the bindings
  // and any other necessary prep work.
  _query: function(connection, obj) {

    // convert ? params into positional bindings (:1)
    obj.sql = this.positionBindings(obj.sql);

    obj.bindings = this.prepBindings(obj.bindings) || [];

    if (!obj.sql) {
      throw new Error('The query is empty');
    }

    return new Promise(function (resolve, reject) {
      connection.execute(obj.sql, obj.bindings, function(err, response) {
        if (err) {
          reject(err);
          return;
        }

        if (!obj.returning) {
          obj.response = response.rows;
          resolve(obj);
          return;
        }
        var rowIds = obj.outParams.map(function (v, i) {
          return response.outBinds['returnParam' + (i ? i : '')];
        });

        connection.execute(obj.returningSql, rowIds, function (err, response) {
          if (err) {
            reject(err);
            return;
          }
          obj.response = response.rows;
          resolve(response);
        });
      });
    });
  },

  // Process the response as returned from the query.
  processResponse: function(obj, runner) {
    var response = obj.response;
    var method = obj.method;
    if (obj.output) {
      return obj.output.call(runner, response);
    }
    switch (method) {
      case 'select':
      case 'pluck':
      case 'first':
        response = helpers.skim(response);
        if (obj.method === 'pluck') {
          response = _.pluck(response, obj.pluck);
        }
        return obj.method === 'first' ? response[0] : response;
      case 'insert':
      case 'del':
      case 'update':
      case 'counter':
        if (obj.returning) {
          if (obj.returning.length > 1 || obj.returning[0] === '*') {
            return response;
          }
          // return an array with values if only one returning value was specified
          return _.flatten(_.map(response, _.values));
        }
        return response.updateCount;
      default:
        return response;
    }
  }

});

module.exports = Client_OracleDb;
