const db = require("../../database");
const { uuid, asyncRoute } = require("../../rendering/http");
const templates = require("./service");
module.exports = function register(api, { documentData }) {
  api.get(
    "/templates",
    asyncRoute(async (req, res) =>
      res.json({ success: true, items: await templates.list() }),
    ),
  );
  api.post(
    "/templates/save",
    asyncRoute(async (req, res) => {
      const { id, name, content } = req.body;
      if (
        (id && !uuid(id)) ||
        typeof name !== "string" ||
        name.includes("\0") ||
        !name.trim() ||
        name.trim().length > 100 ||
        typeof content !== "string" ||
        content.includes("\0") ||
        Buffer.byteLength(content) > 5 * 1024 * 1024
      )
        throw db.fail(400, "Template tidak valid.");
      if (!(await templates.save({ id, name, content }, req.ip)))
        throw db.fail(404, "Template tidak ditemukan.");
      res.json({ success: true });
    }),
  );
  api.post(
    "/templates/delete",
    asyncRoute(async (req, res) => {
      if (!uuid(req.body.id) || req.body.confirm !== true)
        throw db.fail(400, "Konfirmasi hapus diperlukan.");
      await templates.remove(req.body.id, req.ip);
      res.json({ success: true });
    }),
  );
};
