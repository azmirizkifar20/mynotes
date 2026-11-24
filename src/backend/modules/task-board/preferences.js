const { randomUUID } = require("node:crypto");
const { transaction, fail } = require("../../database/connection");
const { uuid, priorities, validText, validDate, validTagIds, validChecklist, normalizeChecklist } = require("./validation");

const validKey = (key) => key === "new" || uuid(key);
const validToken = (token) => token === null || uuid(token);
const draftConflict = () => fail(409, "Draft task sudah berubah di perangkat lain. Muat ulang draft sebelum melanjutkan.", { conflict: true, draftConflict: true });
const draftColumns = 'key,body,updated_at AS "updatedAt",token';

async function preferences() {
  return transaction(async (client) => {
    const { rows } = await client.query("SELECT key,value FROM mdpreview.settings WHERE key IN ('task_board_views','task_board_views_token')");
    const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const { rows: drafts } = await client.query(`SELECT ${draftColumns} FROM mdpreview.task_drafts ORDER BY updated_at DESC,key`);
    return { views: settings.task_board_views || [], viewsToken: settings.task_board_views_token || null, drafts };
  });
}
async function saveViews(body) {
  if (!body || !validToken(body.token) || !Array.isArray(body.views) || body.views.length > 20) throw fail(400, "Gunakan maksimal 20 tampilan tersimpan dengan token yang valid.");
  const views = body.views.map((view) => {
    if (!view || !uuid(view.id) || !validText(view.name, 40) || !view.filters || typeof view.filters !== "object" || Array.isArray(view.filters))
      throw fail(400, "Tampilan tersimpan tidak valid.");
    const f = view.filters;
    if ((f.query !== undefined && !validText(f.query, 200, false)) ||
        [f.statusId, f.tagId].some((id) => id !== undefined && id !== "" && !uuid(id)) ||
        (f.priority !== undefined && f.priority !== "" && !priorities.has(f.priority)) ||
        [f.dateFrom, f.dateTo].some((date) => date !== undefined && !validDate(date)) ||
        (f.dateFrom && f.dateTo && f.dateFrom > f.dateTo) ||
        (f.dateMode !== undefined && !["", "today", "overdue"].includes(f.dateMode)))
      throw fail(400, "Filter tampilan tidak valid.");
    return { id: view.id.toLowerCase(), name: view.name.trim(), filters: {
      query: f.query || "", statusId: f.statusId?.toLowerCase() || "", tagId: f.tagId?.toLowerCase() || "",
      priority: f.priority || "", dateFrom: f.dateFrom || "", dateTo: f.dateTo || "", dateMode: f.dateMode || "",
    } };
  });
  if (new Set(views.map((view) => view.id)).size !== views.length || new Set(views.map((view) => view.name.toLowerCase())).size !== views.length)
    throw fail(400, "Gunakan identitas dan nama tampilan berbeda.");
  return transaction(async (client) => {
    const { rows: [current] } = await client.query("SELECT value FROM mdpreview.settings WHERE key='task_board_views_token'");
    if ((current?.value || null) !== (body.token?.toLowerCase() || null))
      throw fail(409, "Tampilan tersimpan sudah berubah di perangkat lain. Muat ulang papan sebelum menyimpan lagi.", { conflict: true });
    const viewsToken = randomUUID();
    await client.query("INSERT INTO mdpreview.settings(key,value) VALUES('task_board_views',$1),('task_board_views_token',$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [JSON.stringify(views), JSON.stringify(viewsToken)]);
    return { views, viewsToken };
  });
}
function validateDraft(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => !["id", "title", "description", "result", "statusId", "priority", "startDate", "due", "tagIds", "checklist", "revision"].includes(key)) ||
      (body.id !== undefined && !uuid(body.id)) ||
      (body.title !== undefined && !validText(body.title, 120, false)) ||
      [body.description, body.result].some((text) => text !== undefined && !validText(text, 3000, false)) ||
      (body.statusId !== undefined && body.statusId !== "" && !uuid(body.statusId)) ||
      (body.priority !== undefined && body.priority !== "" && !priorities.has(body.priority)) ||
      [body.startDate, body.due].some((date) => date !== undefined && !validDate(date)) ||
      (body.tagIds !== undefined && !validTagIds(body.tagIds)) ||
      (body.checklist !== undefined && !validChecklist(body.checklist, true)) ||
      (body.revision !== undefined && (!Number.isInteger(body.revision) || body.revision < 1)))
    throw fail(400, "Isi draft task tidak valid.");
  const draft = { ...body };
  if (draft.id) draft.id = draft.id.toLowerCase();
  if (draft.statusId) draft.statusId = draft.statusId.toLowerCase();
  if (draft.tagIds) draft.tagIds = draft.tagIds.map((id) => id.toLowerCase());
  if (draft.checklist) draft.checklist = normalizeChecklist(draft.checklist);
  return draft;
}
async function checkedDraft(client, key, token) {
  const { rows: [draft] } = await client.query(`SELECT ${draftColumns} FROM mdpreview.task_drafts WHERE key=$1`, [key]);
  if ((draft?.token || null) !== (token?.toLowerCase() || null)) throw draftConflict();
  return draft;
}
async function saveDraft(body) {
  if (!body || !validKey(body.key) || !validToken(body.token)) throw fail(400, "Identitas draft task tidak valid.");
  const key = body.key.toLowerCase(), content = validateDraft(body.body);
  if (content.id && content.id !== key) throw fail(400, "Identitas task dan draft tidak sesuai.");
  return transaction(async (client) => {
    await checkedDraft(client, key, body.token);
    if (key !== "new") {
      const { rows: [task] } = await client.query("SELECT archived_at FROM mdpreview.tasks WHERE id=$1", [key]);
      if (!task) throw fail(404, "Task tidak ditemukan.");
      if (task.archived_at) throw fail(409, "Task sudah diarsipkan. Pulihkan sebelum mengedit.", { conflict: true });
    }
    if (content.statusId && !(await client.query("SELECT 1 FROM mdpreview.task_statuses WHERE id=$1", [content.statusId])).rowCount)
      throw fail(409, "Status sudah tidak tersedia. Muat ulang papan.", { conflict: true });
    const { rows: [draft] } = await client.query(`INSERT INTO mdpreview.task_drafts(key,body,token) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET body=$2,token=$3,updated_at=now() RETURNING ${draftColumns}`, [key, JSON.stringify(content), randomUUID()]);
    return { draft };
  });
}
async function discardDraft(body) {
  if (!body || !validKey(body.key) || !validToken(body.token)) throw fail(400, "Identitas draft task tidak valid.");
  return transaction(async (client) => {
    const key = body.key.toLowerCase();
    await checkedDraft(client, key, body.token);
    await client.query("DELETE FROM mdpreview.task_drafts WHERE key=$1", [key]);
    return {};
  });
}
async function clearDraft(client, body) {
  if (body.draftKey === undefined && body.draftToken === undefined) return;
  if (!validKey(body.draftKey) || !validToken(body.draftToken) || body.draftKey.toLowerCase() !== (body.id?.toLowerCase() || "new"))
    throw fail(400, "Identitas draft task tidak sesuai.");
  const key = body.draftKey.toLowerCase();
  await checkedDraft(client, key, body.draftToken);
  await client.query("DELETE FROM mdpreview.task_drafts WHERE key=$1", [key]);
}

module.exports = { preferences, saveViews, saveDraft, discardDraft, clearDraft };
