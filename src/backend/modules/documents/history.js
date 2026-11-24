const db = require("../../database");
const { asyncRoute, entry, changed } = require("../../rendering/http");
module.exports = function register(api, { documentData }) {
  api.post(
    "/history",
    asyncRoute(async (req, res) => {
      const row = await entry(req);
      const items = (
        await db.query(
          "SELECT revision,saved_at,octet_length(content) AS bytes FROM mdpreview.versions WHERE entry_id=$1 ORDER BY revision DESC LIMIT 100",
          [row.id],
        )
      ).rows;
      res.json({ success: true, items, revision: row.revision });
    }),
  );
  api.post(
    "/history/preview",
    asyncRoute(async (req, res) => {
      const row = await entry(req);
      const version = (
        await db.query(
          "SELECT content,saved_at FROM mdpreview.versions WHERE entry_id=$1 AND revision=$2",
          [row.id, req.body.version],
        )
      ).rows[0];
      if (!version) throw db.fail(404, "Versi tidak ditemukan.");
      res.json({
        success: true,
        content: version.content.toString("utf8"),
        currentContent: row.content.toString("utf8"),
        currentRevision: row.revision,
        savedAt: version.saved_at,
      });
    }),
  );
  api.post(
    "/history/restore",
    asyncRoute(async (req, res) => {
      const row = await entry(req);
      const version = (
        await db.query(
          "SELECT content FROM mdpreview.versions WHERE entry_id=$1 AND revision=$2",
          [row.id, req.body.version],
        )
      ).rows[0];
      if (!version) throw db.fail(404, "Versi tidak ditemukan.");
      const saved = await db.save(row.path, version.content.toString("utf8"), {
        revision: req.body.revision,
        ip: req.ip,
      });
      changed(res, documentData(saved, req.baseUrl.replace(/\/api$/, "")));
    }),
  );
};
