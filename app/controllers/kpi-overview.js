'use strict';
var boom = require('boom');
var config = require('../config');
var dataLoader = require('../utils/yaml-md-loader');
var carbonData = require('../data/overview-data.json');

module.exports = {
  handler: (request, reply) => {
    let contentP = dataLoader(`${config.baseDir}/content/section-overview-home.md`);

    Promise.all([carbonData, contentP])
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
