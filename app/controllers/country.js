'use strict';
var boom = require('boom');
var config = require('../config');
var dataLoader = require('../utils/yaml-md-loader');

module.exports = {
  countryInfo: {
    handler: (request, reply) => {
      let c = request.params.country;
      dataLoader(`${config.baseDir}/data/country-${c}.md`)
        .then(reply)
        .catch(err => {
          return err.code === 'ENOENT' ? reply(boom.notFound()) : reply(boom.wrap(err));
        });
    }
  }
};
