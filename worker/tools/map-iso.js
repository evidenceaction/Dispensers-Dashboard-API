'use strict';

// Maps a string with the name of an administrative area, and maps it to the
// ISO code of the district / county it belongs to.

var _ = require('lodash');
var areaMap = require('./areas-map.json');

module.exports = function (dirtyName) {
  var matchedArea = _.find(areaMap, function (o) { return clean(o.name) === clean(dirtyName); });
  var mappedIso = (matchedArea) ? (matchedArea.iso || matchedArea.parent_iso) : undefined;

  return mappedIso;
};

function clean (dirtyName) {
  var cleanerName = dirtyName.toLowerCase();
  cleanerName = cleanerName.trim();
  cleanerName = cleanerName.replace('_', ' ');

  return cleanerName;
}
