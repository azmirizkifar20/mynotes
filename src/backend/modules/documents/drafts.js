const { randomUUID } = require("node:crypto");
const db = require("../../database");
const { uuid, asyncRoute, entry } = require("../../rendering/http");
module.exports = function register(api, { documentData }) {
  api.post(
    "/draft/read",
    asyncRoute(async (req, res) => {
      const row = await entry(req);
      const draft =
        (
          await db.query(
            "SELECT content,base_revision,token,updated_at FROM mdpreview.drafts WHERE entry_id=$1",
            [row.id],
          )
        ).rows[0] || null;
      res.json({ success: true, draft });
    }),
  );
  api.post(
    "/draft",
    asyncRoute(async (req, res) => {
      const { content, revision, token } = req.body;
      if (
        typeof content !== "string" ||
        content.includes("\0") ||
        Buffer.byteLength(content) > 5 * 1024 * 1024 ||
        (token !== undefined && token !== null && !uuid(token))
      )
        throw db.fail(400, "Draft tidak valid.");
      const result = await db.transaction(async (client) => {
        const row = await db.get(req.body.filePath, client);
        if (row.kind !== "doc" || row.revision !== revision)
          throw db.fail(
            409,
            "Versi dokumen berubah. Salin tulisanmu sebelum memuat versi terbaru.",
            { conflict: true },
          );
        const before = (
          await client.query(
            "SELECT token FROM mdpreview.drafts WHERE entry_id=$1",
            [row.id],
          )
        ).rows[0];
        if ((before?.token || null) !== (token || null))
          throw db.fail(
            409,
            "Draft berubah di perangkat lain. Tulisanmu tetap di editor.",
            { conflict: true },
          );
        const nextToken = randomUUID();
        await client.query(
          "INSERT INTO mdpreview.drafts(entry_id,content,base_revision,token) VALUES($1,$2,$3,$4) ON CONFLICT(entry_id) DO UPDATE SET content=$2,base_revision=$3,token=$4,updated_at=now()",
          [row.id, content, revision, nextToken],
        );
        return nextToken;
      });
      res.json({ success: true, token: result });
    }),
  );
  api.post(
    "/draft/discard",
    asyncRoute(async (req, res) => {
      if (!uuid(req.body.token))
        throw db.fail(400, "Identitas draft tidak valid.");
      const row = await entry(req);
      const result = await db.query(
        "DELETE FROM mdpreview.drafts WHERE entry_id=$1 AND token=$2",
        [row.id, req.body.token],
      );
      if (!result.rowCount)
        throw db.fail(409, "Draft berubah. Muat ulang sebelum membuangnya.");
      res.json({ success: true });
    }),
  );
};
