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
    let startDate = moment.utc(config.startDate, 'YYYY-MM-DD').startOf('month');

    let dataP = knex.raw(`
      SELECT
        d.*,
        avg(a.tcr_positive) * d.dispensers_total as avg_dispenser
      FROM dispenser_program d
      LEFT JOIN adoption a
        ON a.program = d.program
        AND a.year = d.year
        AND a.month = d.month
      WHERE d.year >= "${startDate.format('YYYY')}"
      GROUP BY d.program, d.year, d.month
    `).then(function (results) {
      // console.timeEnd('query');
      // console.time('perf');

      // Add timestep to each row
      results = steps.addStep(results);

      // ######################################################################
      // Calculate the use rate

      // Notes on general method.
      // Sampling (1.5%) is done by program, ~8 households measured per waterpoint
      // Any reading > 0 is a positive reading
      //
      // Calculate:
      // The sql query return the avg adoption rate per program-year-month.
      // It also provides the total amount of dispensers.
      //
      // The next code calculates the avg adoption rate per timestep
      // weighing each program's avg by total dispensers installed.

      let finalValues = [];
      _(results)
        .filter(o => o.timestep >= startDate && o.timestep < moment.utc().startOf('month'))
        .groupBy('timestep')
        .forEach((o, tsI) => {
          // Total dispensers per time period.
          let totalXPeriod = 0;
          // Avg dispensers in use per time period.
          let inUseXPeriod = 0;
          _.forEach(o, d => {
            // A null means that there's no reading and shouldn't be taken into
            // account (it's not a 0)
            if (d.avg_dispenser !== null) {
              inUseXPeriod += d.avg_dispenser;
              totalXPeriod += d.dispensers_total;
            }
          });

          finalValues.push({
            timestep: moment.utc(tsI).format('YYYY-MM-DD'),
            tcr_avg: inUseXPeriod / totalXPeriod * 100,
            debug: {
              readings: inUseXPeriod,
              dis_total: totalXPeriod
            }
          });
        });

      // console.timeEnd('perf');
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

    // console.time('query');
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
