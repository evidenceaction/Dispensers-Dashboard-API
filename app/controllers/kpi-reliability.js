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
    let countrySlice = utils.parseCountry(request.params.country);
    if (countrySlice === 99) {
      return reply(boom.badRequest('No valid country'));
    }

    let contentP = dataLoader(`${config.baseDir}/content/section-reliability-${request.params.country || 'home'}.md`);

    // Issues are only logged since 2015-07-01
    let startDate = moment.utc('2015-07-01', 'YYYY-MM-DD').startOf('month');

    let dataP = Promise.all([
      knex.select().from('dispenser_district')
        .where('year', '>=', startDate.format('YYYY'))
        .whereIn('country', countrySlice),
      knex.select('category', 'year', 'month').from('issues')
        .count('rowid as outages_reported')
        .whereIn('country', countrySlice)
        .groupBy('month', 'year', 'category'),
      knex.select('id', 'category').from('issues_category')
    ]).then(function (results) {
      // console.timeEnd('query');
      // console.time('perf');

      // Add meta-data about outage categories
      let outageMeta = results[2];

      // Calculate reliability rates
      let finalValues = utils.reliabilityRate(results, startDate);

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
