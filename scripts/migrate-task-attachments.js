const { createHash, randomUUID } = require("node:crypto");
const { query, transaction, pool } = require("../src/backend/database/connection");
const r2 = require("../src/backend/modules/task-board/r2");
const storage = require("../src/backend/modules/task-board/attachment-storage");

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function migrate() {
  await r2.check();
  let migrated = 0;
  for (;;) {
    const { rows: [file] } = await query("SELECT id,task_id,filename,content FROM mdpreview.task_attachments WHERE content IS NOT NULL ORDER BY id LIMIT 1");
    if (!file) break;
    // An attempt UUID isolates concurrent or interrupted retries from each other.
    const object = await storage.stage(file.task_id, randomUUID(), file.filename, file.content);
    const copy = await r2.get(object.bucket, object.key);
    if (copy.length !== file.content.length || digest(copy) !== digest(file.content)) throw new Error("R2 migration readback mismatch; original DB bytes retained");
    const changed = await transaction(async (client) => {
      await client.query("SELECT object_key FROM mdpreview.task_attachment_objects WHERE object_key=$1 FOR KEY SHARE", [object.key]);
      return client.query("UPDATE mdpreview.task_attachments SET object_key=$2,size=$3,content=NULL WHERE id=$1 AND content=$4 RETURNING id", [file.id, object.key, file.content.length, file.content]);
    });
    migrated += changed.rowCount;
  }
  const { rows: [counts] } = await query("SELECT count(*)::integer AS total,count(*) FILTER(WHERE content IS NOT NULL)::integer AS legacy,count(*) FILTER(WHERE object_key IS NOT NULL)::integer AS r2 FROM mdpreview.task_attachments");
  return { migrated, ...counts };
}
if (require.main === module) migrate().then((result) => console.log(JSON.stringify(result)))
  .catch((error) => { console.error("Attachment migration failed:", error.code || error.message); process.exitCode = 1; }).finally(() => pool.end());
module.exports = { migrate };
