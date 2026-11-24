const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const r2 = require("../src/backend/modules/task-board/r2");
const { pool } = require("../src/backend/database/connection");

async function main() {
  await r2.check();
  const key = r2.key("connection-check", randomUUID(), "check.txt"), bucket = r2.bucket();
  const bytes = Buffer.from("MD Previewer R2 connectivity " + randomUUID());
  try {
    await r2.put(bucket, key, bytes);
    assert.deepEqual(await r2.get(bucket, key), bytes);
  } finally { await r2.remove(bucket, key); }
  console.log("R2 connection passed: bucket access, upload, exact readback, delete.");
}
main().catch((error) => { console.error("R2 check failed:", error.code || error.name); process.exitCode = 1; }).finally(() => pool.end());
