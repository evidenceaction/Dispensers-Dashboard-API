'use strict';
var _ = require('lodash');

// Sum data for a particular field, prior to given startDate
module.exports.sumOldData = function (allData, field, startDate) {
  let oldData = _.filter(allData, o => o.timestep < startDate);
  return _.sumBy(oldData, field);
};

// Parse country parameter
module.exports.parseCountry = function (country) {
  if (country) {
    switch (country) {
      case 'kenya':
        return [1];
      case 'uganda':
        return [2];
      case 'malawi':
        return [3];
      default:
        return 99;
    }
  } else {
    return [1, 2, 3];
  }
};
