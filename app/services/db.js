'use strict';
var config = require('../config');
var knex = require('knex');

var db = knex({
  client: 'sqlite3',
  connection: {
    filename: `${config.baseDir}/../${config.db}`
  },
  debug: true,
  useNullAsDefault: true
});

console.log('description', config.baseDir);

module.exports = db;
