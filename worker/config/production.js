/*
 * App config for production.
 */
module.exports = {
  environment: 'production',
  sourceDb: {
    url: 'mlis-evidenceaction.org',
    host: 'mysql-db.cnltbg2tkrfl.eu-central-1.rds.amazonaws.com',
    user: 'devseed',
    password: 'seedguest73',
    database: 'evidence_action_dsw'
  }
};
