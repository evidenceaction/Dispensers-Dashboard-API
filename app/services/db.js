'use strict';
var config = require('../config');
var knex = require('knex');

var db = knex({
  client: 'sqlite3',
  connection: {
    filename: `${config.baseDir}/${config.db}`
  },
  debug: false,
  useNullAsDefault: true
});

module.exports = db;
