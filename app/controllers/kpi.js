'use strict';
var boom = require('boom');
var config = require('../config');
var _ = require('lodash');
var centroids = require('../data/dsw-admin2-centroids.json');
var knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: `${config.baseDir}${config.db}`
  }
});

var startDate = new Date(config.startDate);
var geoData = [];

module.exports = {
  access: {
    handler: (request, reply) => {
      var dispenserCount = 0;
      var peopleCount = 0;
      knex.select('iso', knex.raw('substr(install_date,1,4) as year'), knex.raw('substr(install_date,6,2) as month')).from('dispensers')
        .sum('ppl_served as new_people_served')
        .count('wid as dispensers_installed')
        .groupByRaw('iso, month, year')
        .then(function (rows) {
          // convert to month + year to timestamp
          return Promise.all(rows.map(function (row) {
            row.install_month = new Date(`${row.year}-${row.month}-01`);
            delete row.month;
            delete row.year;
            // Count total dispensers and people served at start of dashboards
            if (row.install_month < startDate) {
              dispenserCount += row.dispensers_installed;
              peopleCount += row.new_people_served;
            }
            return row;
          }));
        }).then(function (rows) {
          // Add coordinates for each area
          _.forEach(_.uniq(_.map(rows, 'iso')), function (iso) {
            geoData.push(_.find(centroids, {'iso': iso}));
          });
          return rows;
        }).then(function (rows) {
          let result = {};
          result.data = rows;
          result.geo = geoData;
          return reply(result);
        }).catch(function (err) {
          console.log('err', err);
          reply(boom.wrap(err));
        });
    }
  },
  usage: {
    handler: (request, reply) => {
      reply({
        statusCode: 200,
        message: 'Usage'
      });
    }
  },
  reliability: {
    handler: (request, reply) => {
      reply({
        statusCode: 200,
        message: 'reliability'
      });
    }
  },
  carbon: {
    handler: (request, reply) => {
      reply({
        statusCode: 200,
        message: 'carbon'
      });
    }
  }
};
