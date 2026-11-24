const fs = require("node:fs");
const multer = require("multer");
const paths = require("../../config/paths");
const { asyncRoute } = require("../../rendering/http");
const { fail } = require("../../database/connection");
const attachments = require("./attachments");
const { viewType } = require("./r2");

module.exports = function register(api) {
  // Busboy emits its limit event at the boundary; allow the inclusive 50 MB limit.
  const upload = multer({ dest: paths.uploads, limits: { fileSize: attachments.limit + 1, files: 1, fields: 3, fieldSize: 1024, parts: 5 } }).single("file");
  api.post("/task-board/attachments/upload", (req, res, next) => upload(req, res, (error) => {
    if (error) return next(fail(400, error.code === "LIMIT_FILE_SIZE" ? "Ukuran lampiran terlalu besar. Maksimal 50 MB per file." : "Upload lampiran gagal. Pilih satu file per pengiriman."));
    next();
  }), asyncRoute(async (req, res) => {
    if (!req.file) throw fail(400, "Pilih lampiran untuk diupload.");
    try {
      const revision = /^\d+$/.test(req.body.revision || "") ? Number(req.body.revision) : null;
      res.json({ success: true, ...await attachments.add({ ...req.body, revision }, fs.readFileSync(req.file.path), req.ip) });
    } finally { fs.rmSync(req.file.path, { force: true }); }
  }));
  api.post("/task-board/attachments/delete", asyncRoute(async (req, res) => res.json({ success: true, ...await attachments.remove(req.body, req.ip) })));
  api.get("/task-board/attachments/:id/view", asyncRoute(async (req, res) => {
    const file = await attachments.view(req.params.id);
    res.set({ "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" });
    if (file.url) return res.redirect(302, file.url);
    res.set({ "Content-Type": viewType(file.filename), "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" }).send(file.content);
  }));
  api.get("/task-board/attachments/:id/download", asyncRoute(async (req, res) => {
    const file = await attachments.download(req.params.id);
    res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" });
    res.attachment(file.filename).type("application/octet-stream").send(file.content);
  }));
};
