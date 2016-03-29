'use strict';
var _ = require('lodash');

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

// ######################################################################
// Calculate the use rate

// Notes on general method.
// Sampling (1.5%) is done by program, ~8 households measured per waterpoint
// Any reading > 0 is a positive reading
//
// Calculate:
// The sql query return the avg adoption rate per program-year-month.
// It also provides the total amount of dispensers.
//
// The next code calculates the avg adoption rate per timestep
// weighing each program's avg by total dispensers installed.

module.exports.useRate = function (results, startDate) {
  let finalValues = [];
  _(results)
    .filter(o => o.timestep >= startDate && o.timestep < moment.utc().startOf('month'))
    .groupBy('timestep')
    .forEach((o, tsI) => {
      // Total dispensers per time period.
      let totalXPeriod = 0;
      // Avg dispensers in use per time period.
      let inUseXPeriod = 0;
      _.forEach(o, d => {
        // A null means that there's no reading and shouldn't be taken into
        // account (it's not a 0)
        if (d.avg_dispenser !== null) {
          inUseXPeriod += d.avg_dispenser;
          totalXPeriod += d.dispensers_total;
        }
      });

      finalValues.push({
        timestep: moment.utc(tsI).format('YYYY-MM-DD'),
        tcr_avg: inUseXPeriod / totalXPeriod * 100,
        raw: {
          readings: inUseXPeriod,
          dis_total: totalXPeriod
        }
      });
    });
  return finalValues;
};
