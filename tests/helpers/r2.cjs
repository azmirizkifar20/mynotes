const assert = require('node:assert/strict');
assert.equal(process.env.MDPREVIEW_TEST_ISOLATED, '1');
Object.assign(process.env, { R2_ENDPOINT:'https://fixture.r2.cloudflarestorage.com', R2_BUCKET:'fixture-private', R2_ACCESS_KEY_ID:'fixture-access', R2_SECRET_ACCESS_KEY:'fixture-secret' });
const r2 = require('../../src/backend/modules/task-board/r2');
const objects = new Map();
Object.assign(r2, {
  configured: () => true,
  bucket: () => 'fixture-private',
  check: async () => {},
  put: async (bucket, key, bytes) => { objects.set(bucket + ':' + key, bytes); },
  get: async (bucket, key) => {
    const bytes = objects.get(bucket + ':' + key);
    if (!bytes) throw new Error('NoSuchKey');
    return bytes;
  },
  remove: async (bucket, key) => { objects.delete(bucket + ':' + key); },
});
module.exports = { r2, objects };
