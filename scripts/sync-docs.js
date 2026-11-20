const db = require('../database');
const mirror = require('../document-sync');
mirror.sync().then(count => console.log('Document mirror synchronized:', count, 'entries.'))
  .catch(error => { console.error('Mirror sync failed:', error.code || error.message); process.exitCode = 1; })
  .finally(() => db.pool.end());
