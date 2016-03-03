'use strict';
var base = require('../controllers/base');
var access = require('../controllers/kpi-access');
var carbon = require('../controllers/kpi-carbon');
var reliability = require('../controllers/kpi-reliability');
var usage = require('../controllers/kpi-usage');

module.exports = [
  { method: 'GET', path: '/', config: base.index },
  { method: 'GET', path: '/kpi/access', config: access },
  { method: 'GET', path: '/kpi/carbon', config: carbon },
  { method: 'GET', path: '/kpi/reliability', config: reliability },
  { method: 'GET', path: '/kpi/usage', config: usage }
];
