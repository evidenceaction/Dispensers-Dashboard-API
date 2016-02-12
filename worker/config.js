var _ = require('lodash');

// Prod settings act as base.
var config = require('./config/production');

// local config overrides everything when present.
try {
  var localConfig = require('./config/local');
  _.merge(config, localConfig);
} catch (e) {
  // Local file is not mandatory.
}

// Overrides by ENV variables:
config.debug = process.env.OC_DEBUG || config.debug;

module.exports = config;
