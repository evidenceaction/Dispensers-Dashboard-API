'use strict';
var boom = require('boom');
var config = require('../config');
var moment = require('moment');
var _ = require('lodash');
var knex = require('../services/db');
var dataLoader = require('../utils/yaml-md-loader');
var steps = require('../utils/timesteps');
var utils = require('../utils/data-utils');

module.exports = {
  handler: (request, reply) => {
    let contentP = dataLoader(`${config.baseDir}/content/section-usage-home.md`);

    let dataP = knex.select('wid', 'tcr', 'fcr', 'country', 'year', 'month').from('adoption')
      .then(function (rows) {
        // Generate an array with relevant time-steps
        let startDate = moment.utc(config.startDate, 'YYYY-MM-DD').startOf('month');
        let timeSteps = steps.generateSteps(startDate);

        // Add the timestep to each data point
        let adoptionData = steps.addStep(rows);

        let groupedData = _.groupBy(adoptionData, 'timestep');

        let finalValues = [];
        _.forEach(timeSteps, function (step) {
          let stepValues = {
            timestep: step
          };

          if (groupedData[step]) {
            let s = groupedData[step];

            let fcr_positives = _.countBy(s, o => o.fcr > 0);
            let fcr_total = _.countBy(s, o => _.isNumber(o.fcr));

            let tcr_positives = _.countBy(s, o => o.tcr > 0);
            let tcr_total = _.countBy(s, o => _.isNumber(o.tcr));

            stepValues.fcr_avg = fcr_positives.true / fcr_total.true * 100;
            stepValues.tcr_avg = tcr_positives.true / tcr_total.true * 100;
          } else {
            stepValues.fcr_avg = null;
            stepValues.tcr_avg = null;
          }
          finalValues.push(stepValues);
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
