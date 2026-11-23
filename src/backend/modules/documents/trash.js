const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { transaction, fail } = require("../../database/connection");
const { audit } = require("../../database/audit");
const { get } = require("./service");
const { parentPath, validPath } = require("./paths");
const { deletionImpact } = require("../task-board/mentions");
async function trash(key, force, ip, mentionToken) {
  if (!validPath(key) || key === "/") throw fail(400, "Path tidak valid.");
  if (mentionToken !== undefined && (typeof mentionToken !== "string" || !/^[a-f0-9]{64}$/.test(mentionToken)))
    throw fail(400, "Konfirmasi referensi dokumen tidak valid.");
  return transaction(async (client) => {
    const row = await get(key, client);
    const impact = await deletionImpact(client, row.path);
    if (impact && mentionToken !== impact.token)
      throw fail(409, "Dokumen disebut di task board. Konfirmasi dampaknya sebelum menghapus.", { mentionImpact: impact });
    if (
      row.kind === "folder" &&
      !force &&
      (
        await client.query(
          "SELECT 1 FROM mdpreview.entries WHERE deleted_at IS NULL AND starts_with(path,$1) LIMIT 1",
          [row.path + "/"],
        )
      ).rowCount
    )
      throw fail(
        409,
        "Folder masih berisi item. Konfirmasi pemindahan semua isi ke sampah.",
        { requiresConfirm: true },
      );
    const group = randomUUID();
    await client.query(
      "UPDATE mdpreview.entries SET deleted_at=now(),trash_id=$2 WHERE deleted_at IS NULL AND (path=$1 OR starts_with(path,$1 || '/'))",
      [row.path, group],
    );
    await audit("TRASH", row.path, ip, client);
  });
}

async function restoreTrash(group, permanently, ip) {
  return transaction(async (client) => {
    const rows = (
      await client.query(
        "SELECT * FROM mdpreview.entries WHERE trash_id=$1 AND deleted_at IS NOT NULL ORDER BY length(path)",
        [group],
      )
    ).rows;
    if (!rows.length) throw fail(404, "Item sampah tidak ditemukan.");
    if (permanently)
      await client.query(
        "DELETE FROM mdpreview.entries WHERE trash_id=$1 AND deleted_at IS NOT NULL",
        [group],
      );
    else {
      const parent = await get(parentPath(rows[0].path), client);
      if (parent.kind !== "folder")
        throw fail(409, "Pulihkan folder induknya terlebih dahulu.");
      const destination =
        parent.path.replace(/\/$/, "") +
        "/" +
        path.posix.basename(rows[0].path);
      await client.query(
        "UPDATE mdpreview.entries SET path=$2 || substr(path,length($3)+1),deleted_at=NULL,trash_id=NULL WHERE trash_id=$1",
        [group, destination, rows[0].path],
      );
    }
    await audit(
      permanently ? "PURGE" : "TRASH_RESTORE",
      rows[0].path,
      ip,
      client,
    );
  });
}
module.exports = { trash, restoreTrash };
