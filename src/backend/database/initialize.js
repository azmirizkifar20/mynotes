const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { query, transaction, fail } = require("./connection");
async function initialize() {
  await transaction(async (client) => {
    await client.query(
      fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"),
    );
    if ((await client.query(
      "INSERT INTO mdpreview.task_board(id) VALUES(1) ON CONFLICT DO NOTHING RETURNING id",
    )).rowCount) {
      for (const [position, [name, tone]] of [
        ["Ide", "neutral"], ["Siap dikerjakan", "blue"],
        ["Dikerjakan", "amber"], ["Selesai", "green"],
      ].entries()) {
        await client.query(
          "INSERT INTO mdpreview.task_statuses(id,name,tone,position,completed) VALUES($1,$2,$3,$4,$5)",
          [randomUUID(), name, tone, position, position === 3],
        );
      }
    }
    if ((await client.query("INSERT INTO mdpreview.settings(key,value) VALUES('task_archive_seeded','true') ON CONFLICT DO NOTHING RETURNING key")).rowCount) {
      if ((await client.query("UPDATE mdpreview.task_statuses SET completed=true WHERE lower(btrim(name))='selesai' AND NOT completed")).rowCount)
        await client.query("UPDATE mdpreview.task_board SET revision=revision+1 WHERE id=1");
    }
    if ((await client.query("INSERT INTO mdpreview.settings(key,value) VALUES('today_status_seeded','true') ON CONFLICT DO NOTHING RETURNING key")).rowCount) {
      if ((await client.query("UPDATE mdpreview.task_statuses SET in_progress=true WHERE lower(btrim(name)) IN ('dikerjakan','sedang dikerjakan','in progress') AND NOT completed")).rowCount)
        await client.query("UPDATE mdpreview.task_board SET revision=revision+1 WHERE id=1");
    }
    const templates = [
      [
        "Catatan meeting",
        "# Catatan meeting\n\n## Tanggal\n\n## Peserta\n\n## Pembahasan\n\n## Keputusan\n\n## Tindak lanjut\n- [ ] \n",
      ],
      [
        "Progress harian",
        "# Progress harian\n\n## Selesai\n\n## Kendala\n\n## Berikutnya\n",
      ],
      [
        "Dokumentasi API",
        "# Dokumentasi API\n\n## Endpoint\n\n## Autentikasi\n\n## Request\n```json\n{}\n```\n\n## Response\n```json\n{}\n```\n\n## Error\n",
      ],
    ];
    if (
      !(
        await client.query(
          "SELECT 1 FROM mdpreview.settings WHERE key='templates_seeded'",
        )
      ).rowCount
    ) {
      for (const [name, content] of templates)
        await client.query(
          "INSERT INTO mdpreview.templates(id,name,content) VALUES($1,$2,$3)",
          [randomUUID(), name, content],
        );
      await client.query(
        "INSERT INTO mdpreview.settings VALUES('templates_seeded','true')",
      );
    }
  });
}
async function ready() {
  if (
    !(
      await query("SELECT 1 FROM mdpreview.settings WHERE key='server_import' ")
    ).rowCount
  )
    throw fail(503, "Dokumen server belum dimigrasikan.");
}
module.exports = { initialize, ready };
