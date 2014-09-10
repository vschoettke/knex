/*global expect, describe, it*/

'use strict';

module.exports = function(client, clientName, aliasName) {

  var qb = function () { return new client.QueryBuilder(); };

  var Raw = require('../../../lib/raw');

  function verifySqlResult(expectedObj, sqlObj) {
    Object.keys(expectedObj).forEach(function (key) {
      if (typeof expectedObj[key] === 'function') {
        expectedObj[key](sqlObj[key]);
      } else {
        expect(sqlObj[key]).to.deep.equal(expectedObj[key]);
      }
    });
  }

  function testsql(func, res) {
    var sqlRes = func.toSQL();
    var checkValue = res[clientName] || res[aliasName] || res['default'];

    if (!checkValue) {
      throw new Error("Missing test value for name \"" + clientName + "\" or it's alias \"" + aliasName + "\" or for \"default\"");
    }

    if (typeof res === 'function') {
      res(sqlRes);
    } else {
      if (typeof checkValue === 'string') {
        verifySqlResult({
          sql: checkValue
        }, sqlRes);
      } else {
        verifySqlResult(checkValue, sqlRes);
      }
    }
  }

  function testquery(func, res) {
    var queryRes = func.toQuery();
    var checkValue = res[clientName] || res[aliasName] || res['default'];

    if (!checkValue) {
      throw new Error("Missing test value for name \"" + clientName + "\" or it's alias \"" + aliasName + "\" or for \"default\"");
    }

    if (typeof res === 'function') {
      res(queryRes);
    } else {
      expect(queryRes).to.deep.equal(checkValue);
    }
  }

  describe("Quoting " + clientName, function() {
    var raw = function(sql, bindings) { return new Raw(sql, bindings); };

    it("basic select", function() {
      testsql(qb().select('*').from('users'), {
        mysql: 'select * from `users`',
        default: 'select * from "users"',
      });
    });

    it("basic select without quoting", function() {
      testsql(qb().quote(false).select('*').from('users'), {
        default: 'select * from users',
      });
    });

    it("adding selects", function() {
      testsql(qb().select('foo').select('bar').select(['baz', 'boom']).from('users'), {
        mysql: 'select `foo`, `bar`, `baz`, `boom` from `users`',
        default: 'select "foo", "bar", "baz", "boom" from "users"'
      });
    });

    it("adding selects without quoting", function() {
      testsql(qb().quote(false).select('foo').select('bar').select(['baz', 'boom']).from('users'), {
        default: 'select foo, bar, baz, boom from users'
      });
    });

    it("basic wheres", function() {
      testsql(qb().select('*').from('users').where('id', '=', 1), {
        mysql: {
          sql: 'select * from `users` where `id` = ?',
          bindings: [1]
        },
        default: {
          sql: 'select * from "users" where "id" = ?',
          bindings: [1]
        }
      });
    });

    it("basic wheres without quoting", function() {
      testsql(qb().quote(false).select('*').from('users').where('id', '=', 1), {
        default: {
          sql: 'select * from users where id = ?',
          bindings: [1]
        }
      });
    });

    it("sub select where ins", function() {
      testsql(qb().select('*').from('users').whereIn('id', function(qb) {
        qb.select('id').from('users').where('age', '>', 25).limit(3);
      }), {
        mysql: {
          sql: 'select * from `users` where `id` in (select `id` from `users` where `age` > ? limit ?)',
          bindings: [25, 3]
        },
        oracle: {
          sql: 'select * from "users" where "id" in (select * from (select "id" from "users" where "age" > ?) where rownum <= ?)',
          bindings: [25, 3]
        },
        default: {
          sql: 'select * from "users" where "id" in (select "id" from "users" where "age" > ? limit ?)',
          bindings: [25, 3]
        }
      });
    });

    it("sub select where ins no quoting", function() {
      testsql(qb().quote(false).select('test').from('users').whereIn('id', function(qb) {
        qb.select('id').from('users').where('age', '>', 25).limit(3);
      }), {
        oracle: {
          sql: 'select test from users where id in (select * from (select id from users where age > ?) where rownum <= ?)',
          bindings: [25, 3]
        },
        default: {
          sql: 'select test from users where id in (select id from users where age > ? limit ?)',
          bindings: [25, 3]
        },
      });
    });

    it("sub select where ins with special words no quoting", function() {
      testsql(qb().quote(false).select('test').from('tEsT').whereIn('id', function(qb) {
        qb.select('id').from('table').where('age', '>', 25).limit(3);
      }), {
        mysql: {
          sql: "select test from `tEsT` where id in (select id from `table` where age > ? limit ?)",
          bindings: [25, 3]
        },
        oracle: {
          sql: 'select test from "tEsT" where id in (select * from (select id from "table" where age > ?) where rownum <= ?)',
          bindings: [25, 3]
        },
        default: {
          sql: 'select test from "tEsT" where id in (select id from "table" where age > ? limit ?)',
          bindings: [25, 3]
        },
      });
    });

    it("raw wheres", function() {
      testsql(qb().select('*').from('users').where(raw('id = ? or email = ?', [1, 'foo'])), {
        mysql: {
          sql: 'select * from `users` where id = ? or email = ?',
          bindings: [1, 'foo']
        },
        default: {
          sql: 'select * from "users" where id = ? or email = ?',
          bindings: [1, 'foo']
        }
      });
    });

    it("raw wheres no quoting", function() {
      testsql(qb().quote(false).select('*').from('users').where(raw('id = ? or "email" = ?', [1, 'foo'])), {
        default: {
          sql: 'select * from users where id = ? or "email" = ?',
          bindings: [1, 'foo']
        }
      });
    });

    it("allows for case-insensitive alias", function() {
      testsql(qb().select(' foo   aS bar ').from('users'), {
        mysql: 'select `foo` as `bar` from `users`',
        oracle: 'select "foo" "bar" from "users"',
        default: 'select "foo" as "bar" from "users"'
      });
    });

    it("allows for case-insensitive alias no quoting", function() {
      testsql(qb().quote(false).select(' foo   aS bar ').from('users'), {
        oracle: 'select foo bar from users',
        default: 'select foo as bar from users',
      });
    });

    it("basic table wrapping", function() {
      testsql(qb().select('foo').from('public.users'), {
        mysql: 'select `foo` from `public`.`users`',
        default: 'select "foo" from "public"."users"'
      });
    });

    it("basic table wrapping no quoting", function() {
      testsql(qb().quote(false).select('foo').from('public.users'), {
        mysql: 'select foo from `public`.users',
        oracle: 'select foo from "public".users',
        default: 'select foo from public.users',
      });
    });

    it('test basic create table with charset and collate', function() {
      console.log("BALLO", client.SchemaBuilder);

      var tableSql = new client.SchemaBuilder().createTable('users', function(table) {
        table.increments('id');
        table.string('email');
      });

      testquery(tableSql, {
        mysql: 'create table `users` (`id` int unsigned not null auto_increment primary key, `email` varchar(255))',
        postgres: "create table \"users\" (\"id\" serial primary key, \"email\" varchar(255))",
        oracle: "create table \"users\" (\"id\" integer not null primary key, \"email\" varchar2(255));\nbegin execute immediate 'create sequence \"users_seq\"'; exception when others then if sqlcode != -955 then raise; end if; end;;\ncreate or replace trigger \"users_id_trg\" before insert on \"users\" for each row when (new.\"id\" is null)  begin select \"users_seq\".nextval into :new.\"id\" from dual; end;",
        sqlite3: "create table \"users\" (\"id\" integer not null primary key autoincrement, \"email\" varchar(255))",
      });
    });

    it('test basic create table with charset and collate', function() {
      var tableSql = new client.SchemaBuilder().quote(false).createTable('users', function(table) {
        table.increments('id');
        table.string('email');
      });

      testquery(tableSql, {
        mysql: 'create table users (id int unsigned not null auto_increment primary key, email varchar(255))',
        postgres: "create table users (id serial primary key, email varchar(255))",
        oracle: "create table users (id integer not null primary key, email varchar2(255));\nbegin execute immediate 'create sequence users_seq'; exception when others then if sqlcode != -955 then raise; end if; end;;\ncreate or replace trigger users_id_trg before insert on users for each row when (new.id is null)  begin select users_seq.nextval into :new.id from dual; end;",
        sqlite3: "create table users (id integer not null primary key autoincrement, email varchar(255))",
      });
    });

  });

};
