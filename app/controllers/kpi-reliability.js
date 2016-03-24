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
    let contentP = dataLoader(`${config.baseDir}/content/section-reliability-home.md`);

    // Issues are only logged since 2015-07-01
    let startDate = moment.utc('2015-07-01', 'YYYY-MM-DD').startOf('month');

    let dataP = Promise.all([
      knex.select().from('dispenser_district')
      .where('year', '>=', startDate.format('YYYY')),
      knex.select('category', 'year', 'month').from('issues')
      .count('rowid as outages_reported')
      .groupBy('month', 'year', 'category'),
      knex.select('id', 'category').from('issues_category')
    ]).then(function (results) {
      // console.timeEnd('query');
      // console.time('perf');

      let dispenserData = results[0];
      let outageData = results[1];
      let outageMeta = results[2];

      // Add the timestep to each data point
      dispenserData = steps.addStep(dispenserData);
      outageData = steps.addStep(outageData);

      let outageValues = _(outageData)
        .filter(o => o.timestep >= startDate && o.timestep <= moment.utc())
        .groupBy('timestep')
        .map((o, i) => ({
          'timestep': o[0].timestep,
          'outages': {
            'total': _.sumBy(o, 'outages_reported'),
            'chlorine': _(o).filter({'category': 30}).sumBy('outages_reported')
          }
        }))
        .value();

      // Merge outages and dispensers and calculate the totals and rates
      var finalValues = [];
      _.forEach(outageValues, function (o) {
        let totalDispensers = _(dispenserData).filter(d => o.timestep.format('YYYY-MM-DD') === d.timestep.format('YYYY-MM-DD')).sumBy('dispensers_total');
        o['functional'] = {
          total: totalDispensers - o.outages.total,
          total_rate: (totalDispensers - o.outages.total) / totalDispensers * 100
        };
        o.outages['hardware'] = o.outages['total'] - o.outages['chlorine'];
        o.outages['total_rate'] = o.outages['total'] / totalDispensers * 100;
        o.outages['chlorine_rate'] = o.outages['chlorine'] / totalDispensers * 100;
        o.outages['hardware_rate'] = o.outages['hardware'] / totalDispensers * 100;
        finalValues.push(o);
      });

      // console.timeEnd('perf');
      return {
        data: _(finalValues).sortBy('timestep'),
        meta: outageMeta
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
