const { randomUUID } = require("node:crypto");
const { transaction, query, fail } = require("../../database/connection");
const { audit } = require("../../database/audit");
const { mentionedIds } = require("./mentions");

const uuid = (value) => typeof value === "string" && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const tones = new Set(["neutral", "blue", "amber", "green", "red"]);
const priorities = new Set(["low", "normal", "high"]);
const validText = (value, max, required = true) => typeof value === "string" && !value.includes("\0") && value.length <= max && (!required || Boolean(value.trim()));
const validDate = (value) => value === "" || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "0001-01-01" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);

function validateTask(body) {
  if (!body || (body.id !== undefined && !uuid(body.id)) ||
      !validText(body.title, 120) || !validText(body.description, 3000, false) ||
      !uuid(body.statusId) || !priorities.has(body.priority) || !validDate(body.due))
    throw fail(400, "Task tidak valid. Periksa judul, deskripsi, status, prioritas, dan tenggat.");
}
function validateStatuses(statuses, moves) {
  if (!Array.isArray(statuses) || !statuses.length || statuses.length > 50 ||
      statuses.some((s) => !s || !uuid(s.id) || !validText(s.name, 32) || !tones.has(s.tone) || (s.completed !== undefined && typeof s.completed !== "boolean")) ||
      new Set(statuses.map((s) => s.id.toLowerCase())).size !== statuses.length ||
      new Set(statuses.map((s) => s.name.trim().toLowerCase())).size !== statuses.length ||
      !moves || typeof moves !== "object" || Array.isArray(moves) ||
      Object.entries(moves).some(([from, to]) => !uuid(from) || !uuid(to)))
    throw fail(400, "Gunakan 1–50 status dengan nama berbeda, warna valid, dan tujuan pemindahan yang valid.");
}
async function snapshot(client) {
  const { rows: [board] } = await client.query("SELECT revision FROM mdpreview.task_board WHERE id=1");
  const { rows: statuses } = await client.query("SELECT id,name,tone,position,completed FROM mdpreview.task_statuses ORDER BY position,id");
  const { rows: tasks } = await client.query("SELECT id,number,title,description,status_id AS \"statusId\",priority,due::text AS due,modified,archived_at AS \"archivedAt\" FROM mdpreview.tasks ORDER BY number");
  const ids = [...new Set(tasks.flatMap((task) => mentionedIds(task.description)))];
  const { rows: documents } = ids.length ? await client.query("SELECT id,path FROM mdpreview.entries WHERE id=ANY($1::uuid[]) AND " + visibleDocuments, [ids]) : { rows: [] };
  return { revision: board.revision, statuses, documents, tasks: tasks.map((task) => ({ ...task, due: task.due || "" })) };
}
const visibleDocuments = "kind='doc' AND deleted_at IS NULL AND path !~* '^/(steering|superpowers)(/|$)' AND path !~ '/\\.'";
async function suggestDocuments(text = "") {
  if (typeof text !== "string" || text.length > 200 || text.includes("\0")) throw fail(400, "Nama dokumen tidak valid.");
  return (await query("SELECT id,path FROM mdpreview.entries WHERE " + visibleDocuments + " AND strpos(lower(path),lower($1))>0 ORDER BY CASE WHEN strpos(lower(regexp_replace(path,'^.*/','')),lower($1))>0 THEN 0 ELSE 1 END,lower(path),id LIMIT 10", [text.trim()])).rows;
}
async function mentionedDocument(id) {
  if (!uuid(id)) throw fail(400, "Referensi dokumen tidak valid.");
  const row = (await query("SELECT path FROM mdpreview.entries WHERE id=$1 AND " + visibleDocuments, [id])).rows[0];
  if (!row) throw fail(404, "Dokumen tidak tersedia.");
  return row.path;
}
async function advance(client, revision) {
  if (!Number.isInteger(revision) || revision < 1) throw fail(400, "Revisi papan tidak valid.");
  if (!(await client.query("UPDATE mdpreview.task_board SET revision=revision+1 WHERE id=1 AND revision=$1 RETURNING revision", [revision])).rowCount)
    throw fail(409, "Papan sudah berubah di perangkat lain. Muat ulang papan sebelum menyimpan lagi.", { conflict: true });
}
const list = () => transaction(snapshot);
async function saveTask(body, ip) {
  validateTask(body);
  return transaction(async (client) => {
    await advance(client, body.revision);
    if (body.id && (await client.query("SELECT 1 FROM mdpreview.tasks WHERE id=$1 AND archived_at IS NOT NULL", [body.id])).rowCount)
      throw fail(409, "Task sudah diarsipkan. Muat ulang papan dan pulihkan sebelum mengedit.", { conflict: true });
    if (!(await client.query("SELECT 1 FROM mdpreview.task_statuses WHERE id=$1", [body.statusId])).rowCount)
      throw fail(409, "Status sudah tidak tersedia. Muat ulang papan.", { conflict: true });
    const values = [body.id || randomUUID(), body.title.trim(), body.description.trim(), body.statusId, body.priority, body.due || null];
    const result = body.id
      ? await client.query("UPDATE mdpreview.tasks SET title=$2,description=$3,status_id=$4,priority=$5,due=$6,modified=now() WHERE id=$1 RETURNING id", values)
      : await client.query("INSERT INTO mdpreview.tasks(id,title,description,status_id,priority,due) VALUES($1,$2,$3,$4,$5,$6) RETURNING id", values);
    if (!result.rowCount) throw fail(404, "Task tidak ditemukan.");
    await audit(body.id ? "TASK_SAVE" : "TASK_CREATE", body.title.trim(), ip, client);
    return { board: await snapshot(client), taskId: result.rows[0].id };
  });
}
async function removeTask(body, ip) {
  if (!body || !uuid(body.id) || body.confirm !== true) throw fail(400, "Konfirmasi hapus task diperlukan.");
  return transaction(async (client) => {
    await advance(client, body.revision);
    const result = await client.query("DELETE FROM mdpreview.tasks WHERE id=$1 RETURNING title", [body.id]);
    if (!result.rowCount) throw fail(404, "Task tidak ditemukan.");
    await audit("TASK_DELETE", result.rows[0].title, ip, client);
    return { board: await snapshot(client) };
  });
}
async function setArchived(body, archived, ip) {
  if (!body || !uuid(body.id) || body.confirm !== true) throw fail(400, "Konfirmasi arsip atau pemulihan task diperlukan.");
  return transaction(async (client) => {
    await advance(client, body.revision);
    const { rows: [task] } = await client.query("SELECT t.title,t.archived_at,s.completed FROM mdpreview.tasks t JOIN mdpreview.task_statuses s ON s.id=t.status_id WHERE t.id=$1", [body.id]);
    if (!task) throw fail(404, "Task tidak ditemukan.");
    if (archived ? task.archived_at || !task.completed : !task.archived_at)
      throw fail(409, archived ? "Task hanya bisa diarsipkan jika aktif dan berstatus selesai. Muat ulang papan." : "Task sudah tidak ada di arsip. Muat ulang papan.", { conflict: true });
    await client.query("UPDATE mdpreview.tasks SET archived_at=CASE WHEN $2 THEN now() ELSE NULL END,modified=now() WHERE id=$1", [body.id, archived]);
    await audit(archived ? "TASK_ARCHIVE" : "TASK_UNARCHIVE", task.title, ip, client);
    return { board: await snapshot(client), taskId: body.id };
  });
}
const archiveTask = (body, ip) => setArchived(body, true, ip);
const restoreTask = (body, ip) => setArchived(body, false, ip);
async function saveStatuses(body, ip) {
  if (!body) throw fail(400, "Pengaturan status tidak valid.");
  validateStatuses(body.statuses, body.moves);
  const statuses = body.statuses.map((s) => ({ ...s, id: s.id.toLowerCase(), name: s.name.trim() }));
  const moves = Object.fromEntries(Object.entries(body.moves).map(([from, to]) => [from.toLowerCase(), to.toLowerCase()]));
  return transaction(async (client) => {
    await advance(client, body.revision);
    const { rows: previous } = await client.query("SELECT id FROM mdpreview.task_statuses");
    const ids = new Set(statuses.map((s) => s.id)), oldIds = new Set(previous.map((s) => s.id));
    if (Object.entries(moves).some(([from, to]) => !oldIds.has(from) || ids.has(from) || !ids.has(to)))
      throw fail(400, "Tujuan pemindahan task tidak valid.");
    // Release unique names first so swapping two status names is atomic and valid.
    for (const { id } of previous)
      await client.query("UPDATE mdpreview.task_statuses SET name=$2 WHERE id=$1", [id, randomUUID().slice(0, 32)]);
    for (const [position, status] of statuses.entries())
      await client.query("INSERT INTO mdpreview.task_statuses(id,name,tone,position,completed) VALUES($1,$2,$3,$4,COALESCE($5,false)) ON CONFLICT(id) DO UPDATE SET name=$2,tone=$3,position=$4,completed=COALESCE($5,mdpreview.task_statuses.completed)", [status.id, status.name, status.tone, position, status.completed ?? null]);
    for (const { id } of previous) {
      if (ids.has(id)) continue;
      if (moves[id]) await client.query("UPDATE mdpreview.tasks SET status_id=$2,modified=now() WHERE status_id=$1", [id, moves[id]]);
      if ((await client.query("SELECT 1 FROM mdpreview.tasks WHERE status_id=$1 LIMIT 1", [id])).rowCount)
        throw fail(400, "Pilih status tujuan untuk semua task sebelum menghapus status.");
      await client.query("DELETE FROM mdpreview.task_statuses WHERE id=$1", [id]);
    }
    await audit("TASK_STATUSES_SAVE", `${statuses.length} status`, ip, client);
    return { board: await snapshot(client) };
  });
}
module.exports = { list, saveTask, removeTask, archiveTask, restoreTask, saveStatuses, suggestDocuments, mentionedDocument, validateTask, validateStatuses, validDate };
