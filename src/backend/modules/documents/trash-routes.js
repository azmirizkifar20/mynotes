const db = require("../../database");
const { uuid, asyncRoute, changed } = require("../../rendering/http");
module.exports = function register(api, { documentData }) {
  api.get(
    "/trash",
    asyncRoute(async (req, res) => {
      const rows = (
        await db.query(
          "SELECT DISTINCT ON (trash_id) trash_id AS id,path,kind,deleted_at FROM mdpreview.entries WHERE deleted_at IS NOT NULL ORDER BY trash_id,length(path),path",
        )
      ).rows;
      res.json({
        success: true,
        items: rows.sort((a, b) => b.deleted_at - a.deleted_at),
      });
    }),
  );
  api.post(
    "/trash/restore",
    asyncRoute(async (req, res) => {
      if (!uuid(req.body.id)) throw db.fail(400, "Item sampah tidak valid.");
      await db.restoreTrash(req.body.id, false, req.ip);
      changed(res);
    }),
  );
  api.post(
    "/trash/purge",
    asyncRoute(async (req, res) => {
      if (!uuid(req.body.id) || req.body.confirm !== true)
        throw db.fail(400, "Konfirmasi hapus permanen diperlukan.");
      await db.restoreTrash(req.body.id, true, req.ip);
      changed(res);
    }),
  );
};
