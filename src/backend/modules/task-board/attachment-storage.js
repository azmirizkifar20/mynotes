const { pool, query, fail } = require("../../database/connection");
const r2 = require("./r2");

async function stage(taskId, id, filename, source) {
  const key = r2.key(taskId, id, filename), bucket = r2.bucket();
  // The intent survives a crash or an uncertain DB commit; only unreferenced objects are collected.
  await query("INSERT INTO mdpreview.task_attachment_objects(object_key,bucket) VALUES($1,$2)", [key, bucket]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const object = await client.query("SELECT object_key FROM mdpreview.task_attachment_objects WHERE object_key=$1 FOR UPDATE", [key]);
    if (!object.rowCount) throw fail(409, "Upload lampiran kedaluwarsa. Pilih file dan upload ulang.");
    // Keep GC out during PUT, including when an old uploader resumes after the grace period.
    await r2.put(bucket, key, source);
    await client.query("UPDATE mdpreview.task_attachment_objects SET delete_after=now()+interval '1 hour' WHERE object_key=$1", [key]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
  return { key, bucket };
}
let running = false, timer;
async function cleanup() {
  if (running || !r2.configured()) return;
  running = true;
  let firstError;
  try {
    for (let n = 0; n < 20; n++) {
      const client = await pool.connect();
      let object;
      try {
        await client.query("BEGIN");
        ({ rows: [object] } = await client.query(`SELECT o.object_key,o.bucket FROM mdpreview.task_attachment_objects o
          WHERE o.delete_after <= now() AND NOT EXISTS(SELECT 1 FROM mdpreview.task_attachments a WHERE a.object_key=o.object_key)
          ORDER BY o.delete_after FOR UPDATE OF o SKIP LOCKED LIMIT 1`));
        if (!object) { await client.query("COMMIT"); break; }
        // FK/row locks prevent a pending uploader from attaching an object being deleted.
        await client.query("DELETE FROM mdpreview.task_attachment_objects WHERE object_key=$1", [object.object_key]);
        await r2.remove(object.bucket, object.object_key);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        if (!object) throw error;
        await client.query("UPDATE mdpreview.task_attachment_objects SET delete_after=now()+interval '5 minutes' WHERE object_key=$1", [object.object_key]);
        firstError ||= error;
      } finally { client.release(); }
    }
    if (firstError) throw firstError;
  } finally { running = false; }
}
function start() {
  const run = () => cleanup().catch((error) => console.error("Attachment cleanup failed:", error.code || error.name));
  run();
  timer = setInterval(run, 60000);
  timer.unref();
}
const stop = () => clearInterval(timer);
module.exports = { stage, cleanup, start, stop };
