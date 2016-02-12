'use strict';
var base = require('../controllers/base');
var country = require('../controllers/country');

module.exports = [
  { method: 'GET', path: '/', config: base.index },
  { method: 'GET', path: '/country/{country}', config: country.countryInfo }
];
