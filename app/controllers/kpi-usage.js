'use strict';
var boom = require('boom');
var config = require('../config');
var moment = require('moment');
var _ = require('lodash');
var knex = require('../services/db');
var dataLoader = require('../utils/yaml-md-loader');
var steps = require('../utils/timesteps');

module.exports = {
  handler: (request, reply) => {
    let contentP = dataLoader(`${config.baseDir}/content/section-usage-home.md`);

    let dataP = knex.select('wid', 'tcr', 'fcr', 'country', 'year', 'month').from('adoption')
      .then(function (rows) {
        // Group on year and month
        _.forEach(rows, o => o.ym = `${o.year}-${o.month}`);
        let groupedData = _.groupBy(rows, 'ym');

        // Calculate the average readings by group
        let averageReadings = [];
        _.forEach(groupedData, function (group, i) {
          let fcrPositiveReadings = _.countBy(group, o => o.fcr > 0);
          let fcrTotalReadings = _.countBy(group, o => _.isNumber(o.fcr));

          let tcrPositiveReadings = _.countBy(group, o => o.tcr > 0);
          let tcrTotalReadings = _.countBy(group, o => _.isNumber(o.tcr));

          let stepValues = {
            timestep: moment.utc(`${i}-01`, 'YYYY-MM-DD'),
            fcr_avg: fcrPositiveReadings.true / fcrTotalReadings.true * 100,
            tcr_avg: tcrPositiveReadings.true / tcrTotalReadings.true * 100
          };
          averageReadings.push(stepValues);
        });

        // Generate an array with relevant time-steps
        let startDate = moment.utc(config.startDate, 'YYYY-MM-DD').startOf('month');
        let timeSteps = steps.generateSteps(startDate);

        // Store the final data, ensuring there is data for each timestep
        let finalValues = [];
        _.forEach(timeSteps, function (step) {
          // Check if there is data for a given time-step
          let match = _.find(averageReadings, o => o.timestep.format('YYYY-MM-DD') === step.format('YYYY-MM-DD'));
          if (match) {
            finalValues.push(match);
          } else {
            // Otherwise create a new object for the time-step
            finalValues.push({
              timestep: step,
              fcr_avg: null,
              tcr_avg: null
            });
          }
        });

        return {
          meta: {
            tresholds: [
              {
                name: 'Minimum',
                value: 30
              },
              {
                name: 'Maximum',
                value: 60
              }
            ]
          },
          data: finalValues
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
