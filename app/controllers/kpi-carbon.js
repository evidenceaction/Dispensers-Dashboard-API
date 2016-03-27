'use strict';
var boom = require('boom');
var _ = require('lodash');
var config = require('../config');
var dataLoader = require('../utils/yaml-md-loader');
var carbonData = require('../data/carbon-data.json');
var utils = require('../utils/data-utils');

module.exports = {
  handler: (request, reply) => {
    let countrySlice = utils.parseCountry(request.params.country);
    if (countrySlice === 99) {
      return reply(boom.badRequest('No valid country'));
    }

    let dataP = _(carbonData).filter(o => (countrySlice.indexOf(o.id) > -1));

    let contentP = dataLoader(`${config.baseDir}/content/section-carbon-${request.params.country || 'home'}.md`);

    Promise.all([dataP, contentP])
      .then(res => {
        res = {
          'data': res[0],
          'content': res[1]
        };
        reply(res);
      })
      .catch(err => {
        console.log('err', err);
        reply(boom.wrap(err));
      });
  }
};
