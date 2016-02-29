'use strict';
var boom = require('boom');
var config = require('../config');
var moment = require('moment');
var _ = require('lodash');
var centroids = require('../data/dsw-admin2-centroids.json');
var knex = require('../services/db');

module.exports = {
  access: {
    handler: (request, reply) => {
      knex.select('iso', 'year', 'month').from('dispensers')
        .sum('ppl_served as new_people_served')
        .count('wid as dispensers_installed')
        .groupByRaw('iso, month, year')
        .then(function (rows) {
          // Generate an array with relevant time-steps
          let timeSteps = [];
          var startDate = moment(config.startDate).startOf('month');
          var now = moment();
          for (let d = startDate; d <= now; d.month(d.month() + 1)) {
            timeSteps.push(d);
          }

          // Convert month + year to timestamp
          rows.forEach(function (row) {
            row.installation = moment(`${row.year}-${row.month}-01`, 'YYYY-M-DD');
          });

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
            let oldInstalls = _.filter(r, function (o) { return o.installation < startDate; });
            let dispenserCount = _.sumBy(oldInstalls, 'dispensers_installed');
            let peopleCount = _.sumBy(oldInstalls, 'new_people_served');

            _.forEach(timeSteps, function (step) {
              // Check if there is data for a given time-step
              let match = _.find(r, { 'installation': step });
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
                  installation: step,
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
      reply({
        statusCode: 200,
        message: 'reliability'
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
