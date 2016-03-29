'use strict';
var boom = require('boom');
var config = require('../config');
var moment = require('moment');
var _ = require('lodash');
var knex = require('../services/db');
var dataLoader = require('../utils/yaml-md-loader');
var utils = require('../utils/data-utils');

module.exports = {
  handler: (request, reply) => {
    let countrySlice = utils.parseCountry(request.params.country);
    if (countrySlice === 99) {
      return reply(boom.badRequest('No valid country'));
    }

    let contentP = dataLoader(`${config.baseDir}/content/section-overview-${request.params.country || 'home'}.md`);
    let startDate = moment.utc(config.startDate, 'YYYY-MM-DD').startOf('month');

    let dataP = Promise.all([
      knex.raw(`
        SELECT *
        FROM dispenser_district
        WHERE
          year = "${moment.utc().format('YYYY')}" AND
          month = "${moment.utc().format('M')}" AND
          country IN (${countrySlice})
      `),
      knex.raw(`
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
      `),
      knex.select().from('dispenser_district')
        .where('year', '>=', startDate.format('YYYY'))
        .whereIn('country', countrySlice),
      knex.select('category', 'year', 'month').from('issues')
        .count('rowid as outages_reported')
        .whereIn('country', countrySlice)
        .groupBy('month', 'year', 'category')
    ]).then(function (results) {
      // console.timeEnd('query');
      // console.time('perf');
      let dispenserData = results[0];
      let usageData = results[1];
      let reliabilityData = [results[2], results[3]];
      let carbonData = require('../data/carbon-data.json');

      let finalValues = [];

      // Total amount of people served
      finalValues.push({
        'kpi': 'access',
        'value': _(dispenserData).sumBy('people_total'),
        'format': 'absolute',
        'description': 'people with access'
      });

      // Avg adoption rate
      let monthlyUseRates = utils.useRate(usageData, startDate);
      let useRate = _.mean(_.map(monthlyUseRates, 'tcr_avg'));

      // This rate is weighted by amount of dispenser installed
      // let useRate = _(monthlyUseRates).sumBy('raw_total_positives') / _(monthlyUseRates).sumBy('raw_dispensers_measured');

      finalValues.push({
        'kpi': 'usage',
        'value': useRate,
        'format': 'percent',
        'description': 'avg adoption rate'
      });

      // Avg rate of functioning dispensers
      let monthlyReliabilityRates = utils.reliabilityRate(reliabilityData, moment.utc('2015-07-01', 'YYYY-MM-DD'));
      // Calculate weighted average
      let reliabilityRate = _.mean(_.map(monthlyReliabilityRates, 'functional.total_rate'));

      finalValues.push({
        'kpi': 'reliability',
        'value': reliabilityRate,
        'format': 'percent',
        'description': 'dispensers without outages, monthly average since July 2015'
      });

      // Total amount of carbon credits generated
      // Carbon json is simply filtered by country and totals are summed
      finalValues.push({
        'kpi': 'carbon',
        'value': _(carbonData).filter(o => (countrySlice.indexOf(o.id) > -1)).map('values').flatten().sumBy('credits'),
        'format': 'absolute',
        'description': 'carbon credits generated'
      });

      // console.timeEnd('perf');
      return {
        'data': finalValues
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
