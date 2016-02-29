/*
 * App config for production.
 */
module.exports = {
  environment: 'production',
  connection: {
    host: 'localhost',
    port: 3000
  },
  db: 'data/dsw-dashboard.sqlite',
  startDate: '2014-07-01'
};
