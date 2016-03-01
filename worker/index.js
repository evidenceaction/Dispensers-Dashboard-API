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

// TOO: Improve parallelize independent sql statements

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
    // Connect to the source DB.
    sourceDb.query('SELECT * FROM dispenser_database', function (err, rows, fields) {
      callback(err, rows);
    });
  },
  function (rows, callback) {
    // Process and write the results to the SQLite.
    finalDb.serialize(function () {
      finalDb.run('CREATE TABLE dispensers (wid INTEGER, iso TEXT, district TEXT, install_date TEXT, year INTEGER, month INTEGER, ppl_served INTEGER)');
      var entries = [];
      for (var i in rows) {
        var mappedISO = mapISO(rows[i].district);
        var month = rows[i].installation_date.substring(5, 7);
        var year = rows[i].installation_date.substring(0, 4);
        entries.push(`(${rows[i].waterpoint_id}, "${mappedISO}", "${rows[i].district}", "${rows[i].installation_date}", "${year}", "${month}", ${rows[i].pple_served})`);
      }
      finalDb.run('INSERT INTO dispensers VALUES' + entries.join(', '), callback);
    });
  },
  function (callback) {
    // Connect to the source DB.
    sourceDb.query('SELECT * FROM issues', function (err, rows, fields) {
      callback(err, rows);
    });
  },
  function (rows, callback) {
    // Process and write the results to the SQLite.
    finalDb.serialize(function () {
      finalDb.run('CREATE TABLE issues (wid INTEGER, category INTEGER, issue_date TEXT, year INTEGER, month INTEGER)');
      var entries = [];
      for (var i in rows) {
        var splitDate = rows[i].date_created.split('-');
        var month = splitDate[1];
        var year = splitDate[2];
        entries.push(`(${rows[i].waterpoint_id}, "${rows[i].category}", "${rows[i].date_created}", "${year}", "${month}")`);
      }
      finalDb.run('INSERT INTO issues VALUES' + entries.join(', '), callback);
    });
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
