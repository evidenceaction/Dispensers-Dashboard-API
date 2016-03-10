'use strict';
var moment = require('moment');

// Generate an array with timesteps relevant for the dashboards
module.exports.generateSteps = function (startDate) {
  let timeSteps = [];
  var now = moment();
  for (let d = startDate.clone(); d <= now; d.month(d.month() + 1)) {
    timeSteps.push(d.clone());
  }
  return timeSteps;
};

// Add a date object to each object in an array
module.exports.addStep = function (rows) {
  rows.forEach(function (row) {
    row.timestep = moment.utc(`${row.year}-${row.month}-01`, 'YYYY-MM-DD');
  });
  return rows;
};
