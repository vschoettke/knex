/*global describe, it, expect, d, before, after*/

'use strict';

module.exports = function(knex) {

  describe('Quote', function() {

    before(function () {
      return knex.schema.quote(false).dropTableIfExists('test_quote');
    });

    after(function () {
      return knex.schema.quote(false).dropTableIfExists('test_quote');
    });

    it('create table non-quoting', function () {
      return knex.schema.quote(false)
        .createTable('test_quote', function(table) {
          table.engine('InnoDB');
          table.comment('A table comment.');
          table.bigIncrements('id');
          table.string('firstName').index();
          table.string('last_name');
          table.string('table').unique().nullable();
          table.integer('logins').defaultTo(1).index().comment();
          if (knex.client.dialect === 'oracle') {
            // use string instead to force varchar2 to avoid later problems with join and union
            table.string('about', 4000).comment('A comment.');
          } else {
            table.text('about').comment('A comment.');
          }
          table.timestamps();
        }).testSql(function(tester) {
          tester('mysql', [
            'create table test_quote (id bigint unsigned not null auto_increment primary key, `firstName` varchar(255), last_name varchar(255), `table` varchar(255) null, logins int default \'1\', about text comment \'A comment.\', created_at datetime, updated_at datetime) default character set utf8 engine = InnoDB comment = \'A table comment.\'',
            'alter table test_quote add index test_quote_firstname_index(`firstName`)',
            'alter table test_quote add unique test_quote_table_unique(`table`)',
            'alter table test_quote add index test_quote_logins_index(logins)']);
          tester('postgresql', [
            'create table test_quote (id bigserial primary key, "firstName" varchar(255), last_name varchar(255), "table" varchar(255) null, logins integer default \'1\', about text, created_at timestamptz, updated_at timestamptz)',
            'comment on table test_quote is \'A table comment.\'',
            "comment on column test_quote.logins is NULL",
            'comment on column test_quote.about is \'A comment.\'',
            'create index test_quote_firstname_index on test_quote ("firstName")',
            'alter table test_quote add constraint test_quote_table_unique unique ("table")',
            'create index test_quote_logins_index on test_quote (logins)']);
          tester('sqlite3', [
            'create table test_quote (id integer not null primary key autoincrement, "firstName" varchar(255), last_name varchar(255), "table" varchar(255) null, logins integer default \'1\', about text, created_at datetime, updated_at datetime)',
            'create index test_quote_firstname_index on test_quote ("firstName")',
            'create unique index test_quote_table_unique on test_quote ("table")',
            'create index test_quote_logins_index on test_quote (logins)']);
          tester('oracle', [
            'create table test_quote (id number(20, 0) not null primary key, "firstName" varchar2(255), last_name varchar2(255), "table" varchar2(255) null, logins integer default \'1\', about varchar2(4000), created_at timestamp, updated_at timestamp)',
            'comment on table test_quote is \'A table comment.\'',
            "begin execute immediate 'create sequence test_quote_seq'; exception when others then if sqlcode != -955 then raise; end if; end;",
            "create or replace trigger test_quote_id_trg before insert on test_quote for each row when (new.id is null)  begin select test_quote_seq.nextval into :new.id from dual; end;",
            "comment on column test_quote.logins is \'\'",
            'comment on column test_quote.about is \'A comment.\'',
            'create index test_quote_firstname_index on test_quote ("firstName")',
            'alter table test_quote add constraint test_quote_table_unique unique ("table")',
            'create index test_quote_logins_index on test_quote (logins)']);
        });
    });

    it('insert values no-quoting', function () {
      return knex('test_quote').quote(false).insert({
        firstName: 'Test',
        last_name: 'User',
        table: 'test@example.com',
        logins: 1,
        about: 'Lorem ipsum Dolore labore incididunt enim.',
        created_at: d,
        updated_at: d
      }, 'id').testSql(function(tester) {
        tester(
          ['mysql'],
          'insert into test_quote (about, created_at, `firstName`, last_name, logins, `table`, updated_at) values (?, ?, ?, ?, ?, ?, ?)',
          ['Lorem ipsum Dolore labore incididunt enim.', d, 'Test','User', 1, 'test@example.com', d],
          [1]
        );
        tester(
          'sqlite3',
          'insert into test_quote (about, created_at, "firstName", last_name, logins, "table", updated_at) values (?, ?, ?, ?, ?, ?, ?) returning "id"',
          ['Lorem ipsum Dolore labore incididunt enim.', d, 'Test','User', 1, 'test@example.com', d],
          ['1']
        );
        tester(
          'postgresql',
          'insert into test_quote (about, created_at, "firstName", last_name, logins, "table", updated_at) values (?, ?, ?, ?, ?, ?, ?) returning "id"',
          ['Lorem ipsum Dolore labore incididunt enim.', d, 'Test', 'User', 1, 'test@example.com', d],
          ['1']
        );
        tester(
          'oracle',
          'insert into test_quote (about, created_at, "firstName", last_name, logins, "table", updated_at) values (?, ?, ?, ?, ?, ?, ?) returning ROWID into ?',
          ['Lorem ipsum Dolore labore incididunt enim.', d,'Test','User', 1, 'test@example.com', d, function (v) { return v.toString() === '[object ReturningHelper:id]';}],
          [1]
        );
      });
    });

    it('selects no-quoting', function () {
      return knex('test_quote').quote(false).testSql(function (tester) {
        tester(
          ['mysql', 'sqlite3', 'postgresql', 'oracle'],
          'select * from test_quote'
        );
      }).then(function (res) {
        expect(res).to.deep.equal([{
          id: 1,
          about: "Lorem ipsum Dolore labore incididunt enim.",
          created_at: d,
          firstName: "Test",
          last_name: "User",
          logins: 1,
          table: "test@example.com",
          updated_at: d
        }]);
      });
    });

    it('selects with-quoting for oracle', function () {
      if (knex.client.dialect !== 'oracle') {
        return;
      }
      return knex('TEST_QUOTE').testSql(function (tester) {
        tester(
          ['mysql', 'sqlite3', 'postgresql', 'oracle'],
          'select * from test_quote'
        );
      }).then(function (res) {
        console.log(JSON.stringify(res));

        expect(res).to.deep.equal([{
          ID: 1,
          ABOUT: "Lorem ipsum Dolore labore incididunt enim.",
          CREATED_AT: d,
          firstName: "Test",
          LAST_NAME: "User",
          LOGINS: 1,
          table: "test@example.com",
          UPDATED_AT: d
        }]);
      });
    });

    it('drop non-quoting', function () {
        return knex.schema.quote(false).dropTableIfExists('test_quote').testSql(function(tester) {
            tester(['sqlite3', 'mysql', 'postgresql'], ['drop table if exists test_quote']);
            tester('oracle', [
              "begin execute immediate 'drop table test_quote'; exception when others then if sqlcode != -942 then raise; end if; end;",
              "begin execute immediate 'drop sequence test_quote_seq'; exception when others then if sqlcode != -2289 then raise; end if; end;"
            ]);
        });
    });

  });

};
