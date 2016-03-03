'use strict';
var base = require('../controllers/base');
var kpi = require('../controllers/kpi');

module.exports = [
  { method: 'GET', path: '/', config: base.index },
  { method: 'GET', path: '/kpi/access', config: kpi.access },
  { method: 'GET', path: '/kpi/usage', config: kpi.usage },
  { method: 'GET', path: '/kpi/reliability', config: kpi.reliability },
  { method: 'GET', path: '/kpi/carbon', config: kpi.carbon }
];
