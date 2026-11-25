const { Marked } = require("marked");
const { query, fail } = require("../../database/connection");
const { uuid } = require("../task-board/validation");
const parser = new Marked();
const visible = "deleted_at IS NULL AND kind IN ('doc','pdf') AND path !~* '^/(steering|superpowers)(/|$)' AND path !~ '/\\.'";

function referencedIds(content) {
  const ids = new Set();
  parser.walkTokens(parser.lexer(content), (token) => {
    if (token.type !== "link") return;
    const match = /^\/share\/document\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/?(?:#.*)?$/i.exec(token.href);
    if (match) ids.add(match[1].toLowerCase());
  });
  return [...ids];
}

async function relations(id) {
  if (!uuid(id)) throw fail(400, "Referensi dokumen tidak valid.");
  id = id.toLowerCase();
  const source = (await query("SELECT kind,content FROM mdpreview.entries WHERE id=$1 AND " + visible, [id])).rows[0];
  if (!source) throw fail(404, "Dokumen tidak tersedia.");
  const ids = source.kind === "doc" ? referencedIds(source.content.toString("utf8")) : [];
  const outgoing = ids.length ? (await query("SELECT id,path,kind FROM mdpreview.entries WHERE id=ANY($1::uuid[]) AND " + visible + " ORDER BY lower(path)", [ids])).rows : [];
  // shortcut: scan candidate notes for this personal workspace; index references if document volume grows substantially.
  const candidates = (await query("SELECT id,path,kind,content FROM mdpreview.entries WHERE kind='doc' AND " + visible + " AND position($1 in lower(convert_from(content,'UTF8')))>0 ORDER BY lower(path)", ["/share/document/" + id])).rows;
  const incoming = candidates.filter((row) => referencedIds(row.content.toString("utf8")).includes(id))
    .map(({ content, ...row }) => row);
  return { incoming, outgoing };
}
module.exports = { referencedIds, relations };
