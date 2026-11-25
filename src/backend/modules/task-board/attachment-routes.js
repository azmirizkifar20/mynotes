const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const multer = require("multer");
const paths = require("../../config/paths");
const { asyncRoute } = require("../../rendering/http");
const { fail } = require("../../database/connection");
const attachments = require("./attachments");
const { viewType } = require("./r2");

module.exports = function register(api) {
  // Busboy emits its limit event at the boundary; allow the inclusive 100 MB limit.
  const upload = multer({ dest: paths.uploads, limits: { fileSize: attachments.limit + 1, files: 1, fields: 3, fieldSize: 1024, parts: 5 } }).single("file");
  api.post("/task-board/attachments/upload", asyncRoute(async (req, res) => {
    let file, body;
    try {
      if (req.is("application/octet-stream")) {
        let filename;
        try { filename = decodeURIComponent(req.get("X-Upload-Filename") || ""); }
        catch { throw fail(400, "Nama lampiran tidak valid."); }
        const length = Number(req.get("Content-Length"));
        if (length > attachments.limit) throw fail(413, "Ukuran lampiran terlalu besar. Maksimal 100 MB per file.");
        body = { taskId: req.query.taskId, revision: req.query.revision, filename };
        file = { path: path.join(paths.uploads, randomUUID()), size: 0 };
        await pipeline(req, async function* (chunks) {
          for await (const chunk of chunks) {
            file.size += chunk.length;
            if (file.size > attachments.limit) throw fail(413, "Ukuran lampiran terlalu besar. Maksimal 100 MB per file.");
            yield chunk;
          }
        }, fs.createWriteStream(file.path, { flags: "wx", mode: 0o600 }));
      } else {
        await new Promise((resolve, reject) => upload(req, res, (error) => error
          ? reject(fail(400, error.code === "LIMIT_FILE_SIZE" ? "Ukuran lampiran terlalu besar. Maksimal 100 MB per file." : "Upload lampiran gagal. Pilih satu file per pengiriman."))
          : resolve()));
        file = req.file; body = req.body;
      }
      if (!file) throw fail(400, "Pilih lampiran untuk diupload.");
      const revision = /^\d+$/.test(body.revision || "") ? Number(body.revision) : null;
      res.json({ success: true, ...await attachments.add({ ...body, revision }, file, req.ip) });
    } finally { if (file) await fs.promises.rm(file.path, { force: true }); }
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
