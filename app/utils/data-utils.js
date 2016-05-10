'use strict';
var _ = require('lodash');
var moment = require('moment');
var steps = require('../utils/timesteps');

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
  // Add timestep to each row
  results = steps.addStep(results);

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

      // Since this is grouped by timestep, fetch the moment object from the
      // first result.
      // Can't use 'tsI', which stopped being a moment object in the groupBy
      let ts = o[0].timestep;

      // Add monthly rates, including the total readings and dispensers
      // totalXPeriod only includes dispensers from programs that were sampled
      // so may deviate from total dispensers installed
      if (totalXPeriod > 0) {
        finalValues.push({
          timestep: ts.format('YYYY-MM-DD'),
          tcr_avg: inUseXPeriod / totalXPeriod * 100,
          raw_total_positives: inUseXPeriod,
          raw_dispensers_measured: totalXPeriod
        });
      }
    });
  return finalValues;
};

module.exports.reliabilityRate = function (results, startDate) {
  let dispenserData = results[0];
  let outageData = results[1];

  // Add the timestep to each data point
  dispenserData = steps.addStep(dispenserData);
  outageData = steps.addStep(outageData);

  let outageValues = _(outageData)
    .filter(o => o.timestep >= startDate && o.timestep <= moment.utc())
    .groupBy('timestep')
    .map((o, i) => ({
      'timestep': o[0].timestep,
      'outages': {
        'total': _.sumBy(o, 'outages_reported'),
        'chlorine': _(o).filter({'category': 30}).sumBy('outages_reported')
      }
    }))
    .value();

  // Merge outages and dispensers and calculate the totals and rates
  var finalValues = [];
  _.forEach(outageValues, function (o) {
    let totalDispensers = _(dispenserData).filter(d => o.timestep.format('YYYY-MM-DD') === d.timestep.format('YYYY-MM-DD')).sumBy('dispensers_total');
    o['functional'] = {
      total: totalDispensers - o.outages.total,
      total_rate: (totalDispensers - o.outages.total) / totalDispensers * 100
    };
    o.outages['hardware'] = o.outages['total'] - o.outages['chlorine'];
    o.outages['total_rate'] = o.outages['total'] / totalDispensers * 100;
    o.outages['chlorine_rate'] = o.outages['chlorine'] / totalDispensers * 100;
    o.outages['hardware_rate'] = o.outages['hardware'] / totalDispensers * 100;
    finalValues.push(o);
  });

  return finalValues;
};
