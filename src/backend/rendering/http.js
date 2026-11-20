const db = require("../database");
const mirror = require("../modules/documents/mirror");
const uuid = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const asyncRoute = (work) => (req, res, next) =>
  Promise.resolve(work(req, res, next)).catch(next);
const entry = async (req) => {
  const row = await db.get(req.body.filePath);
  if (row.kind !== "doc") throw db.fail(400, "Pilih dokumen Markdown.");
  return row;
};
const changed = (res, result = {}) => {
  mirror
    .sync()
    .catch((error) =>
      console.error("Mirror pending:", error.code || error.name),
    );
  return res.json({ success: true, ...result });
};
module.exports = { uuid, asyncRoute, entry, changed };
