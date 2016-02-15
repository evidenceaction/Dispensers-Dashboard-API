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
config.sourceDb.host = process.env.SOURCEDB_HOST || config.sourceDb.host;
config.sourceDb.user = process.env.SOURCEDB_USER || config.sourceDb.user;
config.sourceDb.password = process.env.SOURCEDB_PASS || config.sourceDb.password;
config.sourceDb.database = process.env.SOURCEDB_DB || config.sourceDb.database;

module.exports = config;
