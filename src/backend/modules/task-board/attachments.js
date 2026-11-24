const { randomUUID } = require("node:crypto");
const { TextDecoder } = require("node:util");
const { transaction, query, fail } = require("../../database/connection");
const { audit } = require("../../database/audit");
const { snapshot, advance } = require("./service");
const storage = require("./attachment-storage");
const r2 = require("./r2");

const limit = 50 * 1024 * 1024;
const uuid = (value) => typeof value === "string" && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
function validateFile(filename, bytes) {
  if (typeof filename !== "string" || !filename.trim() || filename.length > 200 || /[\x00-\x1f\x7f/\\]/.test(filename) || filename.startsWith(".") || /[. ]$/.test(filename))
    throw fail(400, "Nama lampiran tidak valid. Gunakan maksimal 200 karakter tanpa pemisah folder.");
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > limit) throw fail(400, "Lampiran harus berisi data, maksimal 50 MB per file.");
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  const head = bytes.subarray(0, 32), hex = head.toString("hex"), text = head.toString("latin1");
  const zip = /^(504b0304|504b0506|504b0708)/.test(hex), ole = hex.startsWith("d0cf11e0a1b11ae1");
  const video = text.slice(4, 8) === "ftyp", ebml = hex.startsWith("1a45dfa3");
  const checks = {
    pdf: text.startsWith("%PDF-"), zip, rar: hex.startsWith("526172211a0700") || hex.startsWith("526172211a070100"),
    xls: ole, xlsx: zip, ppt: ole, pptx: zip,
    png: hex.startsWith("89504e470d0a1a0a"), jpg: hex.startsWith("ffd8ff"), jpeg: hex.startsWith("ffd8ff"),
    gif: /^(GIF87a|GIF89a)/.test(text), webp: text.startsWith("RIFF") && text.slice(8, 12) === "WEBP",
    avif: video && /avif|avis/.test(text.slice(8)), bmp: text.startsWith("BM"),
    mp4: video, m4v: video, mov: video, webm: ebml, mkv: ebml,
    avi: text.startsWith("RIFF") && text.slice(8, 12) === "AVI ",
  };
  if (["md", "markdown", "csv"].includes(ext)) {
    try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw fail(400, "Lampiran teks harus menggunakan UTF-8."); }
    if (bytes.includes(0)) throw fail(400, "Lampiran teks berisi data biner.");
  } else if (!checks[ext]) throw fail(400, "Format atau isi file tidak didukung. Pilih PDF, ZIP, RAR, Excel, PowerPoint, Markdown, gambar, atau video.");
}
async function activeTask(client, id) {
  if (!uuid(id)) throw fail(400, "Task tidak valid.");
  const { rows: [task] } = await client.query("SELECT title,archived_at FROM mdpreview.tasks WHERE id=$1", [id]);
  if (!task) throw fail(404, "Task tidak ditemukan.");
  if (task.archived_at) throw fail(409, "Pulihkan task dari arsip sebelum mengubah lampiran.", { conflict: true });
  return task;
}
async function add(body, bytes, ip) {
  validateFile(body.filename, bytes);
  // Reject stale/archived/full requests before uploading; recheck inside the final transaction.
  await transaction(async (client) => {
    if (!Number.isInteger(body.revision) || body.revision < 1) throw fail(400, "Revisi papan tidak valid.");
    const { rows: [board] } = await client.query("SELECT revision FROM mdpreview.task_board WHERE id=1");
    if (board.revision !== body.revision) throw fail(409, "Papan sudah berubah di perangkat lain. Muat ulang papan sebelum menyimpan lagi.", { conflict: true });
    await activeTask(client, body.taskId);
    const { rows: [row] } = await client.query("SELECT count(*)::integer AS count FROM mdpreview.task_attachments WHERE task_id=$1", [body.taskId]);
    if (row.count >= 10) throw fail(400, "Maksimal 10 lampiran per task. Hapus salah satu lampiran terlebih dahulu.");
  });
  const id = randomUUID();
  const object = await storage.stage(body.taskId, id, body.filename, bytes);
  return transaction(async (client) => {
    await advance(client, body.revision);
    const task = await activeTask(client, body.taskId);
    const { rows: [available] } = await client.query("SELECT n AS slot FROM generate_series(1,10) n WHERE NOT EXISTS(SELECT 1 FROM mdpreview.task_attachments WHERE task_id=$1 AND slot=n) ORDER BY n LIMIT 1", [body.taskId]);
    if (!available) throw fail(400, "Maksimal 10 lampiran per task. Hapus salah satu lampiran terlebih dahulu.");
    await client.query("SELECT object_key FROM mdpreview.task_attachment_objects WHERE object_key=$1 FOR KEY SHARE", [object.key]);
    await client.query("INSERT INTO mdpreview.task_attachments(id,task_id,slot,filename,object_key,size) VALUES($1,$2,$3,$4,$5,$6)", [id, body.taskId, available.slot, body.filename, object.key, bytes.length]);
    await audit("TASK_ATTACHMENT_ADD", task.title + ": " + body.filename, ip, client);
    return { board: await snapshot(client) };
  });
}
async function remove(body, ip) {
  if (!body || !uuid(body.id) || body.confirm !== true) throw fail(400, "Konfirmasi hapus lampiran diperlukan.");
  return transaction(async (client) => {
    await advance(client, body.revision);
    const task = await activeTask(client, body.taskId);
    const result = await client.query("DELETE FROM mdpreview.task_attachments WHERE id=$1 AND task_id=$2 RETURNING filename", [body.id, body.taskId]);
    if (!result.rowCount) throw fail(404, "Lampiran tidak ditemukan.");
    await audit("TASK_ATTACHMENT_DELETE", task.title + ": " + result.rows[0].filename, ip, client);
    return { board: await snapshot(client) };
  });
}
async function find(id) {
  if (!uuid(id)) throw fail(404, "Lampiran tidak ditemukan.");
  const { rows: [row] } = await query("SELECT a.filename,a.content,a.size,a.object_key,o.bucket FROM mdpreview.task_attachments a LEFT JOIN mdpreview.task_attachment_objects o ON o.object_key=a.object_key WHERE a.id=$1", [id]);
  if (!row) throw fail(404, "Lampiran tidak ditemukan.");
  return row;
}
async function view(id) {
  const row = await find(id);
  if (row.content) return { filename: row.filename, content: row.content };
  return { url: await r2.view(row.bucket, row.object_key, row.filename) };
}
async function download(id) {
  const row = await find(id);
  if (row.content) return { filename: row.filename, content: row.content };
  try {
    const content = await r2.get(row.bucket, row.object_key);
    if (content.length !== row.size) throw new Error("Attachment size mismatch");
    return { filename: row.filename, content };
  } catch {
    throw fail(503, "Lampiran belum bisa diunduh dari R2. Coba lagi nanti.");
  }
}
module.exports = { limit, validateFile, add, remove, download, view };
