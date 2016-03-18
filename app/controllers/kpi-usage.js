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

    let dataP = Promise.all([
      knex.select().from('adoption'),
      knex.select().from('dispenser_totals')
    ]).then(function (results) {
      let adoptionData = results[0];
      let dispenserData = results[1];

      // Generate an array with relevant time-steps
      let startDate = moment.utc(config.startDate, 'YYYY-MM-DD').startOf('month');
      let timeSteps = steps.generateSteps(startDate);

      // ######################################################################
      // Calculate the use rate

      // Notes on general method.
      // Sampling (1.5%) is done by program, ~8 households measured per waterpoint
      // Any reading > 0 is a positive reading
      //
      // Calculate:
      // 1. avg reading per waterpoint (not weighing by household)
      // 2. avg reading per program
      // 3. avg reading for whole DSW, weighted by dispenser count

      // Add indication of timestamp
      _.forEach(adoptionData, o => o.ym = `${o.year}-${o.month}`);

      let averageReadings = [];
      // Group by timestep and by program
      _.forEach(_.groupBy(adoptionData, 'ym'), function (tsGroup, tsI) {
        let adoptionTs = 0;

        _.forEach(_.groupBy(tsGroup, 'program'), function (prGroup, prI) {
          // The average is just the mean of positive (1) and negative (0) readings
          let adoptionWp = [];
          _.forEach(_.groupBy(prGroup, 'wid'), function (wpGroup, wpI) {
            adoptionWp.push(_.chain(wpGroup).map('tcr_positive').mean().value());
          });

          // Get the dispenser totals for this program
          let dispensersProgram = _.find(dispenserData, { month: tsGroup[0].month, year: tsGroup[0].year, program: prI });

          if (dispensersProgram) {
            // Add average readings, multiplied by total dispensers in the program
            adoptionTs += _.mean(adoptionWp) * dispensersProgram.dispensers_total;
          }
        });

        // Get the total amount of dispensers installed this month
        let dispensersTs = _.sumBy(_.filter(dispenserData, { month: tsGroup[0].month, year: tsGroup[0].year }), 'dispensers_total');
        averageReadings.push({
          timestep: moment.utc(tsI, 'YYYY-MM'),
          tcr_avg: adoptionTs / dispensersTs * 100,
          debug: {
            readings: adoptionTs,
            dis_total: dispensersTs
          }
        });
      });

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
            tcr_avg: null,
            debug: {
              message: 'No readings found'
            }
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
