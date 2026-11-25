const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
assert.equal(process.env.MDPREVIEW_TEST_ISOLATED, '1');
Object.assign(process.env, { R2_ENDPOINT:'https://fixture.r2.cloudflarestorage.com', R2_BUCKET:'fixture', R2_ACCESS_KEY_ID:'fixture', R2_SECRET_ACCESS_KEY:'fixture' });
const { S3Client } = require('@aws-sdk/client-s3');
const r2 = require('../src/backend/modules/task-board/r2');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-stream-'));
const filename = path.join(temporary, 'large.pdf');
const send = S3Client.prototype.send;
let body, fail = false;
async function main() {
  const length = 100 * 1024 * 1024, chunk = Buffer.alloc(64 * 1024, 32), hash = createHash('md5');
  const fd = fs.openSync(filename, 'wx');
  try { for (let size = 0; size < length; size += chunk.length) { fs.writeSync(fd, chunk); hash.update(chunk); } }
  finally { fs.closeSync(fd); }
  const md5 = hash.digest('base64');
  S3Client.prototype.send = async function(command) {
    body = command.input.Body;
    assert(body instanceof fs.ReadStream, 'R2 receives a file stream, never a whole-file buffer');
    assert.equal(command.input.ContentLength, length);
    assert.equal(command.input.ContentMD5, md5);
    if (fail) throw new Error('R2 unavailable');
    let size = 0, chunks = 0;
    const received = createHash('md5');
    for await (const value of body) { assert(value.length <= 64 * 1024); size += value.length; chunks++; received.update(value); }
    assert.equal(size, length); assert(chunks > 1); assert.equal(received.digest('base64'), md5);
  };
  const source = { path: filename, size: length, md5 };
  await r2.put('fixture', r2.key('task', 'stream', 'large.pdf'), source);
  assert(body.destroyed);
  fail = true;
  await assert.rejects(r2.put('fixture', r2.key('task', 'failure', 'large.pdf'), source), /R2 unavailable/);
  assert(body.destroyed, 'Failed PUT closes its file stream');
  console.log('R2 stream checks passed: exact 100 MB, chunks <=64 KB, length/MD5 and stream cleanup on failure.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  S3Client.prototype.send = send;
  fs.rmSync(filename, { force: true }); fs.rmdirSync(temporary);
});
