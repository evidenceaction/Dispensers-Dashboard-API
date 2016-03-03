'use strict';
var boom = require('boom');
var config = require('../config');
var moment = require('moment');
var _ = require('lodash');
var centroids = require('../data/dsw-admin2-centroids.json');
var knex = require('../services/db');
var dataLoader = require('../utils/yaml-md-loader');
var steps = require('../utils/timesteps');
var utils = require('../utils/data-utils');

module.exports = {
  handler: (request, reply) => {
    let contentP = dataLoader(`${config.baseDir}/content/section-access-home.md`);

    let dataP = knex.select('iso', 'year', 'month').from('dispensers')
      .sum('ppl_served as new_people_served')
      .count('wid as dispensers_installed')
      .groupByRaw('iso, month, year')
      .then(function (rows) {
        // Generate an array with relevant time-steps
        let startDate = moment.utc(config.startDate, 'YYYY-MM-DD').startOf('month');
        let timeSteps = steps.generateSteps(startDate);

        // Add the timestep to each data point
        rows = steps.addStep(rows);

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
          let dispenserCount = utils.sumOldData(r, 'dispensers_installed', startDate);
          let peopleCount = utils.sumOldData(r, 'new_people_served', startDate);

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

        return {
          data: dispenserData,
          geo: geoData
        };
      });

    Promise.all([dataP, contentP])
      .then(res => {
        res[0].content = res[1];
        reply(res[0]);
      })
      .catch(err => {
        console.log('err', err);
        reply(boom.wrap(err));
      });
  }
};
