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
    `)]).then(function (results) {
      console.timeEnd('query');
      console.time('perf');
      let dispenserData = results[0];
      let usageData = results[1];
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
      let monthlyRates = utils.useRate(usageData, startDate);

      finalValues.push({
        'kpi': 'usage',
        'value': _(monthlyRates).sumBy('raw_readings') / _(monthlyRates).sumBy('raw_total_dispensers'),
        'format': 'percent',
        'description': 'avg adoption rate'
      });

      // Total amount of people served
      finalValues.push({
        'kpi': 'reliability',
        'value': 0,
        'format': 'percent',
        'description': 'dispensers without outages, monthly average'
      });

      // Total amount of carbon credits generated
      // Carbon json is simply filtered by country and totals are summed
      finalValues.push({
        'kpi': 'carbon',
        'value': _(carbonData).filter(o => (countrySlice.indexOf(o.id) > -1)).map('values').flatten().sumBy('credits'),
        'format': 'absolute',
        'description': 'carbon credits generated'
      });

      console.timeEnd('perf');
      return {
        'data': finalValues
      };
    });

    console.time('query');
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
