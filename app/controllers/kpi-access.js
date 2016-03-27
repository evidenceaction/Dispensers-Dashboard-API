'use strict';
var boom = require('boom');
var config = require('../config');
var moment = require('moment');
var _ = require('lodash');
var centroids = require('../data/dsw-admin2-centroids.json');
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

    let contentP = dataLoader(`${config.baseDir}/content/section-access-home.md`);
    let startDate = moment.utc(config.startDate, 'YYYY-MM-DD').startOf('month');

    let dataP = knex.raw(`
      SELECT
        d.*,
        d.year || "-" || d.month as date
      FROM dispenser_district d
      WHERE year >= "${startDate.format('YYYY')}" AND country IN (${countrySlice})
    `).then(function (results) {
      console.timeEnd('query');
      console.time('perf');

      // Add timestep to each row
      results = steps.addStep(results);

      let omitObsolete = o => _.omit(o, ['iso', 'year', 'month', 'date']);
      let filterDate = o => o.timestep >= startDate;

      // Groups dispenser data by ISO code, returns an object of arrays
      // mapValues maps over the objects and omits obsolete properties and
      // filters by startDate
      // map turns it all into key value records
      let finalValues = _(results)
        .groupBy('iso')
        .mapValues(arr => _(arr).map(omitObsolete).filter(filterDate))
        .map((value, key) => ({ 'iso': key, 'values': value }));

      // Generates an array with centroids for the regions
      let geoData = _(finalValues)
        .map(o => _.find(centroids, {'iso': o.iso}));

      console.timeEnd('perf');
      return {
        data: finalValues,
        geo: geoData
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
