'use strict';

var async = require('async');
var fs = require('fs');
var mysql = require('mysql');
var sqlite = require('sqlite3');
var mapISO = require('./tools/map-iso');
var config = require('./config');

var file = './dsw-dashboard.sqlite';
var finalDb;
var sourceDb;

async.waterfall([
  function (callback) {
    // Create the SQLite db, but first remove the existing one.
    fs.unlink(file, function (err, stats) {
      // If the file doesn't exist already, don't throw an error.
      if (err && err.code !== 'ENOENT') {
        console.error(err.message);
        return callback(err);
      }
      finalDb = new sqlite.Database(file);
      callback();
    });
  },
  function (callback) {
    sourceDb = mysql.createConnection(config.sourceDb);
    callback();
  },
  function (callback) {
    // Process and write the results to the SQLite.
    finalDb.parallelize(function () {
      finalDb.run('CREATE TABLE dispensers (wid INTEGER, iso TEXT, district TEXT, install_date TEXT, year INTEGER, month INTEGER, ppl_served INTEGER)');
      finalDb.run('CREATE TABLE issues (wid INTEGER, category INTEGER, issue_date TEXT, year INTEGER, month INTEGER)');
      finalDb.run('CREATE TABLE issues_category (id INTEGER, category TEXT)');
      finalDb.run('CREATE TABLE adoption (wid INTEGER, tcr DECIMAL, fcr DECIMAL, country INTEGER, month INTEGER, year INTEGER)');
    });
    callback();
  },
  function (callback) {
    async.parallel([
      function (cb) {
        sourceDb.query('SELECT * FROM dispenser_database', function (err, rows, fields) {
          cb(err, rows);
        });
      },
      function (cb) {
        sourceDb.query('SELECT * FROM issues', function (err, rows, fields) {
          cb(err, rows);
        });
      },
      function (cb) {
        sourceDb.query('SELECT * FROM issues_category', function (err, rows, fields) {
          cb(err, rows);
        });
      },
      function (cb) {
        sourceDb.query('SELECT * FROM dsw_per_adoption_rates', function (err, rows, fields) {
          cb(err, rows);
        });
      }
    ], function (err, results) {
      if (err) console.log(err);
      callback(null, results);
    });
  },
  function (results, callback) {
    var dispensers = results[0];
    var issues = results[1];
    var issues_cat = results[2];
    var adoption_rates = results[3];

    // Process and write the results to the SQLite.
    finalDb.parallelize(function () {
      var d = [];
      for (var di in dispensers) {
        var mappedISO = mapISO(dispensers[di].district);
        var month = dispensers[di].installation_date.substring(5, 7);
        var year = dispensers[di].installation_date.substring(0, 4);
        d.push(`(${dispensers[di].waterpoint_id}, "${mappedISO}", "${dispensers[di].district}", "${dispensers[di].installation_date}", "${year}", "${month}", ${dispensers[di].pple_served})`);
      }
      finalDb.run('INSERT INTO dispensers VALUES' + d.join(', '));

      var is = [];
      for (var ii in issues) {
        var splitDate = issues[ii].date_created.split('-');
        month = splitDate[1];
        year = splitDate[2];
        is.push(`(${issues[ii].waterpoint_id}, "${issues[ii].category}", "${issues[ii].date_created}", "${year}", "${month}")`);
      }
      finalDb.run('INSERT INTO issues VALUES' + is.join(', '));

      var c = [];
      for (var ci in issues_cat) {
        c.push(`(${issues_cat[ci].id}, "${issues_cat[ci].category}")`);
      }
      finalDb.run('INSERT INTO issues_category VALUES' + c.join(', '));

      var a = [];
      for (var ai in adoption_rates) {
        a.push(`("${adoption_rates[ai].c102_wpt_id}", "${adoption_rates[ai].c803_tcr_reading}", "${adoption_rates[ai].c806_fcr_reading}", "${adoption_rates[ai].country}", "${adoption_rates[ai].month}", "${adoption_rates[ai].year}")`);
      }
      finalDb.run('INSERT INTO adoption VALUES' + a.join(', '));
    });
    callback();
  },
  function (callback) {
    // Close all connections.
    finalDb.close();
    sourceDb.end();
    callback();
  }
], function (err) {
  if (err) console.log(err);
});
