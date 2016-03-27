'use strict';
var base = require('../controllers/base');
var access = require('../controllers/kpi-access');
var carbon = require('../controllers/kpi-carbon');
var overview = require('../controllers/kpi-overview');
var reliability = require('../controllers/kpi-reliability');
var usage = require('../controllers/kpi-usage');

module.exports = [
  { method: 'GET', path: '/', config: base.index },
  { method: 'GET', path: '/kpi/access/{country?}', config: access },
  { method: 'GET', path: '/kpi/carbon/{country?}', config: carbon },
  { method: 'GET', path: '/kpi/overview/{country?}', config: overview },
  { method: 'GET', path: '/kpi/reliability/{country?}', config: reliability },
  { method: 'GET', path: '/kpi/usage/{country?}', config: usage }
];
