'use strict';
var boom = require('boom');
var Promise = require('bluebird');
var config = require('../config');
var moment = require('moment');
var _ = require('lodash');
var centroids = require('../data/dsw-admin2-centroids.json');
var knex = require('../services/db');

// Generate an array with timesteps relevant for the dashboards
function generateTimesteps (startDate) {
  let timeSteps = [];
  var now = moment();
  for (let d = startDate.clone(); d <= now; d.month(d.month() + 1)) {
    timeSteps.push(d.clone());
  }
  return timeSteps;
}

// Generate a date for each object
function addTimestep (rows) {
  rows.forEach(function (row) {
    row.timestep = moment(`${row.year}-${row.month}-01`, 'YYYY-M-DD');
  });
  return rows;
}

// Sum data for a particular field, prior to startDate of the dashboards
function sumOldData (allData, field, startDate) {
  let oldData = _.filter(allData, function (o) { return o.timestep < startDate; });
  return _.sumBy(oldData, field);
}

module.exports = {
  access: {
    handler: (request, reply) => {
      knex.select('iso', 'year', 'month').from('dispensers')
        .sum('ppl_served as new_people_served')
        .count('wid as dispensers_installed')
        .groupByRaw('iso, month, year')
        .then(function (rows) {
          // Generate an array with relevant time-steps
          let startDate = moment(config.startDate).startOf('month');
          let timeSteps = generateTimesteps(startDate);

          // Add the timestep to each data point
          rows = addTimestep(rows);

          // Group by ISO code and loop over each region
          let dispenserData = [];
          _(rows).groupBy('iso').forEach(function (r, iso) {
            if (iso === 'undefined') {
              return;
            }
            let region = {
              iso: iso,
              values: []
            };

            // Calculate the total dispensers installed and people served
            // prior to start date of the dashboards, before ignoring
            // those objects
            console.log(startDate);
            let dispenserCount = sumOldData(r, 'dispensers_installed', startDate);
            let peopleCount = sumOldData(r, 'new_people_served', startDate);

            _.forEach(timeSteps, function (step) {
              // Check if there is data for a given time-step
              let match = _.find(r, o => o.timestep.format('YYYY-MM-DD') === step.format('YYYY-MM-DD'));
              if (match) {
                // If so, update the counts and add it to the regional values
                match.dispenser_total = dispenserCount += match.dispensers_installed;
                match.people_total = peopleCount += match.new_people_served;
                delete match['iso'];
                delete match['year'];
                delete match['month'];
                region.values.push(match);
              } else {
                // Otherwise create a new object for the time-step
                region.values.push({
                  new_people_served: 0,
                  dispensers_installed: 0,
                  timestep: step,
                  dispenser_total: dispenserCount,
                  people_total: peopleCount
                });
              }
            });
            dispenserData.push(region);
          });

          // Add an array with centroids for the regions
          let isos = _.map(dispenserData, 'iso');
          let geoData = [];
          _.forEach(isos, function (iso) {
            geoData.push(_.find(centroids, {'iso': iso}));
          });

          return reply({
            data: dispenserData,
            geo: geoData
          });
        }).catch(function (err) {
          console.log('err', err);
          reply(boom.wrap(err));
        });
    }
  },
  usage: {
    handler: (request, reply) => {
      reply({
        statusCode: 200,
        message: 'Usage'
      });
    }
  },
  reliability: {
    handler: (request, reply) => {
      Promise.all([
        knex.select('year', 'month').from('dispensers')
        .count('wid as dispensers_installed')
        .groupByRaw('month, year'),
        knex.select('category', 'year', 'month').from('issues')
        .count('rowid as outages_reported')
        .groupByRaw('month, year, category'),
        knex.select('id', 'category').from('issues_category')
      ]).then(function (results) {
        let dispenserData = results[0];
        let outageData = results[1];
        let outageMeta = results[2];

        // Generate an array with relevant time-steps
        // Issues are only logged since 2015-07-01
        let startDate = moment('2015-07-01', 'YYYY-MM-DD').startOf('month');
        let timeSteps = generateTimesteps(startDate);

        // Add the timestep to each data point
        dispenserData = addTimestep(dispenserData);
        outageData = addTimestep(outageData);

        // Calculate dispenser total prior to startDate dashboards
        let dispenserCount = sumOldData(dispenserData, 'dispensers_installed', startDate);

        // Generate dispenser objects per timestep
        let dispenserValues = [];
        _.forEach(timeSteps, function (step) {
          // Check if there is dispenser data for a given time-step
          let match = _.find(dispenserData, o => o.timestep.format('YYYY-MM-DD') === step.format('YYYY-MM-DD'));
          if (match) {
            // If so, update the counts and add it to the regional values
            match.dispenser_total = dispenserCount += match.dispensers_installed;
            // delete match['dispensers_installed'];
            delete match['year'];
            delete match['month'];
            dispenserValues.push(match);
          } else {
            // Otherwise create a new object for the time-step
            dispenserValues.push({
              timestep: step,
              dispenser_total: dispenserCount
            });
          }
        });

        // Generate outage objects per timestep
        let outageValues = [];
        _.forEach(timeSteps, function (step) {
          let outagesTimestep = {
            timestep: step,
            outages: {}
          };
          _.forEach(outageData, function (o) {
            if (o.timestep.format('YYYY-MM-DD') === step.format('YYYY-MM-DD')) {
              outagesTimestep.outages[o.category] = o.outages_reported;
            }
          });
          outageValues.push(outagesTimestep);
        });

        // Merge outages and dispensers
        var finalValues = [];
        _.forEach(dispenserValues, function (d) {
          let m = _.assign(d, _.find(outageValues, o => o.timestep.format('YYYY-MM-DD') === d.timestep.format('YYYY-MM-DD')));
          finalValues.push(m);
        });
        
        return reply({
          meta: outageMeta,
          data: finalValues
        });
      }).catch(function (err) {
        console.log('err', err);
        reply(boom.wrap(err));
      });
    }
  },
  carbon: {
    handler: (request, reply) => {
      reply({
        statusCode: 200,
        message: 'carbon'
      });
    }
  }
};
