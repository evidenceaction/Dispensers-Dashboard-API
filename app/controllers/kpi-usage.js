'use strict';
var boom = require('boom');
var config = require('../config');
var moment = require('moment');
var knex = require('../services/db');
var dataLoader = require('../utils/yaml-md-loader');
var steps = require('../utils/timesteps');
var utils = require('../utils/data-utils');

module.exports = {
  handler: (request, reply) => {
    let countrySlice = utils.parseCountry(request.params.country);
    if (countrySlice === 99) {
      return reply(boom.badRequest('No valid country'));
    }

    let contentP = dataLoader(`${config.baseDir}/content/section-usage-${request.params.country || 'home'}.md`);
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
      WHERE d.year >= "${startDate.format('YYYY')}" AND d.country IN (${countrySlice})
      GROUP BY d.program, d.year, d.month
    `).then(function (results) {
      // console.timeEnd('query');
      // console.time('perf');

      // Add timestep to each row
      results = steps.addStep(results);

      // Calculate useRate
      let finalValues = utils.useRate(results, startDate);

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
