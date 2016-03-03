'use strict';
var _ = require('lodash');

// Sum data for a particular field, prior to given startDate
module.exports.sumOldData = function (allData, field, startDate) {
  let oldData = _.filter(allData, o => o.timestep < startDate);
  return _.sumBy(oldData, field);
}
