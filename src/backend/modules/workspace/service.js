const path = require("node:path");
const { query, ROOT_ID } = require("../../database/connection");
const { pageId } = require("../documents/service");
const { hiddenFromListing, parentPath } = require("../documents/paths");
function page(row, ids) {
  return {
    id: pageId(row),
    path: row.path,
    title:
      row.path === "/"
        ? "Ruang kerja"
        : path.posix
            .basename(row.path)
            .replace(row.kind === "doc" ? /\.md$/i : row.kind === "pdf" ? /\.pdf$/i : /$^/, ""),
    type: row.kind,
    parent: row.path === "/" ? null : ids.get(parentPath(row.path)) || "home",
    modified: row.modified.toISOString(),
    revision: row.revision,
    visibility: row.visibility,
    description:
      row.kind === "doc"
        ? "Catatan dan dokumentasi Markdown."
        : row.kind === "pdf" ? "Dokumen PDF."
        : "Dokumentasi dan catatan dalam folder ini.",
  };
}

async function workspace() {
  const rows = (
    await query(
      "SELECT id,path,kind,revision,modified,visibility FROM mdpreview.entries WHERE deleted_at IS NULL AND kind IN ('folder','doc','pdf','image') ORDER BY path",
    )
  ).rows.filter((row) => !hiddenFromListing(row.path));
  const ids = new Map(rows.map((row) => [row.path, pageId(row)]));
  return rows.map((row) => page(row, ids));
}

async function preferences() {
  const rows = (
    await query(
      "SELECT id,favorite,opened_at FROM mdpreview.entries WHERE deleted_at IS NULL AND (favorite OR opened_at IS NOT NULL) AND path !~* '^/(steering|superpowers)(/|$)' ORDER BY opened_at DESC NULLS LAST",
    )
  ).rows;
  const settings = (
    await query(
      "SELECT key,value FROM mdpreview.settings WHERE key IN ('theme','preferences_imported')",
    )
  ).rows;
  return {
    favorites: rows
      .filter((row) => row.favorite)
      .map((row) => (row.id === ROOT_ID ? "home" : row.id)),
    recent: rows
      .filter((row) => row.opened_at)
      .slice(0, 50)
      .map((row) => row.id),
    ...Object.fromEntries(settings.map((row) => [row.key, row.value])),
  };
}
module.exports = { workspace, preferences };
