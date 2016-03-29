'use strict';

var async = require('async');
var fs = require('fs');
var mysql = require('mysql');
var sqlite = require('sqlite3');
var mapISO = require('./tools/map-iso');
var config = require('./config');
var _ = require('lodash');
var moment = require('moment');
var steps = require('../app/utils/timesteps');

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
      finalDb.run('CREATE TABLE issues (wid INTEGER, category INTEGER, issue_date TEXT, year INTEGER, month INTEGER, country INTEGER)');
      finalDb.run('CREATE TABLE issues_category (id INTEGER, category TEXT)');
      finalDb.run('CREATE TABLE adoption (wid INTEGER, tcr_positive DECIMAL, program TEXT, country INTEGER, month INTEGER, year INTEGER)');
      finalDb.run('CREATE TABLE dispenser_program (program TEXT, country INTEGER, year INTEGER, month INTEGER, dispensers_installed INTEGER, dispensers_total INTEGER)');
      finalDb.run('CREATE TABLE dispenser_district (iso TEXT, country INTEGER, year INTEGER, month INTEGER, dispensers_installed INTEGER, dispensers_total INTEGER, new_people_served INTEGER, people_total INTEGER)');
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
        sourceDb.query('SELECT * FROM dsw_per_adoption_rates WHERE c803_tcr_reading REGEXP "^[0-9]+\\.?[0-9]*$" AND year > 0', function (err, rows, fields) {
          cb(err, rows);
        });
      },
      function (cb) {
        sourceDb.query('SELECT program_name, country, month, year, COUNT(waterpoint_id) AS dispensers_installed FROM dispenser_database GROUP BY program_name, month, year;', function (err, rows, fields) {
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
    var dispenser_totals = results[4];

    // Process and write the results to the SQLite.
    finalDb.parallelize(function () {
      let startDate = moment.utc('2008-01-01', 'YYYY-MM-DD');
      let timeSteps = steps.generateSteps(startDate);

      var is = [];
      for (var ii in issues) {
        let splitDate = issues[ii].date_created.split('-');
        let month = splitDate[1];
        let year = splitDate[2];
        is.push(`(${issues[ii].waterpoint_id}, "${issues[ii].category}", "${issues[ii].date_created}", "${year}", "${month}", "${issues[ii].country}")`);
      }
      finalDb.run('INSERT INTO issues VALUES' + is.join(', '));

      var c = [];
      for (var ci in issues_cat) {
        c.push(`(${issues_cat[ci].id}, "${issues_cat[ci].category}")`);
      }
      finalDb.run('INSERT INTO issues_category VALUES' + c.join(', '));

      var a = [];
      for (var ai in adoption_rates) {
        let tcr = adoption_rates[ai].c803_tcr_reading > 0 ? 1 : 0;
        a.push(`("${adoption_rates[ai].c102_wpt_id}", "${tcr}", "${adoption_rates[ai].program}", "${adoption_rates[ai].country}", "${adoption_rates[ai].month}", "${adoption_rates[ai].year}")`);
      }
      finalDb.run('INSERT INTO adoption VALUES' + a.join(', '));

      var dp = [];
      // Add data for each timestep, even if no dispensers are installed
      _.forEach(_.groupBy(dispenser_totals, 'program_name'), function (group, programName) {
        let dispenserCount = 0;
        _.forEach(timeSteps, function (step) {
          let match = _.find(group, { year: step.year(), month: step.month() + 1 });
          if (match) {
            dispenserCount += match.dispensers_installed;
            dp.push(`("${programName}", "${match.country}", "${match.year}", "${match.month}", "${match.dispensers_installed}", "${dispenserCount}")`);
          } else {
            dp.push(`("${programName}", "${group[0].country}", "${step.year()}", "${step.month() + 1}", "0", "${dispenserCount}")`);
          }
        });
      });

      finalDb.run('INSERT INTO dispenser_program VALUES' + dp.join(', '));

      var dd = [];
      // Turn the district string into a consistent ISO code
      for (let i in dispensers) {
        dispensers[i].iso = mapISO(dispensers[i].district);
      }
      // Loop over each district and timestep to prep the db insert
      _(dispensers).groupBy('iso').forEach(function (r, iso) {
        if (iso === 'undefined') {
          return;
        }
        let dCount = 0;
        let pCount = 0;
        _.forEach(timeSteps, function (step) {
          let d = _.filter(r, { year: step.year(), month: step.month() + 1 });
          let dAdded = d.length;
          let pAdded = _.sumBy(d, 'pple_served');
          dCount += dAdded;
          pCount += pAdded;
          dd.push(`("${iso}", "${r[0].country}", "${step.year()}", "${step.month() + 1}", "${dAdded}", "${dCount}", "${pAdded}", "${pCount}")`);
        });
      });

      finalDb.run('INSERT INTO dispenser_district VALUES' + dd.join(', '));
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
