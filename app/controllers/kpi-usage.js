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

      // ######################################################################
      // Calculate the use rate

      // Notes on general method.
      // Sampling (1.5%) is done by program, ~8 households measured per waterpoint
      // Any reading > 0 is a positive reading
      //
      // Calculate:
      // 1. avg reading per program
      // 2. avg reading for whole DSW, weighted by dispenser count

      // Add indication of timestamp
      _.forEach(adoptionData, o => o.ym = `${o.year}-${o.month}`);

      let averageReadings = [];
      // Group by timestep and by program
      _.forEach(_.groupBy(adoptionData, 'ym'), function (tsGroup, tsI) {
        console.log(tsGroup);
        let readingsTs = 0;

        _.forEach(_.groupBy(tsGroup, 'program'), function (prGroup, prI) {
          console.log(prI);
          // Any reading > 0 is considered positive
          let tcrPositivesProgram = _.countBy(prGroup, o => o.tcr > 0);

          // Calculate the average amount of positives for the program
          let tcrAvgProgram = tcrPositivesProgram.true / prGroup.length * 100;

          // Get the dispenser totals for this program
          let dispenserTs = _.find(dispenserData, { month: 1, year: 2015, program: prI });
          console.log(prI, dispenserTs);

          if (dispenserTs) {
            // Add average readings, multiplied by total dispensers in the program
            readingsTs += tcrAvgProgram * dispenserTs.dispenser_total;
          }
        });

        // Get the total amount of dispensers for the full project
        let dispenserCount = _.sumBy(_.filter(dispenserData, { month: 1, year: 2015 }), 'dispenser_total');
        let stepValues = {
          timestep: moment.utc(`${tsI}-01`, 'YYYY-MM-DD'),
          tcr_avg: readingsTs / dispenserCount
        };
        averageReadings.push(stepValues);
      });
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
