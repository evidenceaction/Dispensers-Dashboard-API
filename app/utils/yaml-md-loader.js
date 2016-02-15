'use strict';
var fs = require('fs');
var yaml = require('js-yaml');
var marked = require('marked');

module.exports = function (path, cb) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', function (err, doc) {
      if (err) {
        return reject(err);
      }
      let start = doc.indexOf('---\n');
      let end = doc.indexOf('---', 4);

      if (start !== 0 || end === -1) {
        return reject(new Error('Yaml frontmatter not found in .md file'));
      }

      let frontmatter = doc.substring(start + 4, end);
      let md = doc.substring(end + 4);
      md = marked(doc.substring(end + 4));

      // Get document, or throw exception on error.
      try {
        var settings = yaml.safeLoad(frontmatter);
        settings = settings || {};
      } catch (e) {
        return reject(e);
      }

      settings.content = md;
      return resolve(settings);
    });
  });
};
