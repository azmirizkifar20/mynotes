const fs = require("node:fs");
const { saveImage } = require("./images");
const { asyncRoute, changed } = require("../../rendering/http");
const { fail } = require("../../database/connection");

module.exports = function register(api, { upload }) {
  api.post("/images/upload", upload.single("file"), asyncRoute(async (req, res) => {
    if (!req.file) throw fail(400, "Pilih satu gambar untuk diupload.");
    try {
      changed(res, await saveImage(req.body.filePath, fs.readFileSync(req.file.path), req.ip));
    } finally { fs.rmSync(req.file.path, { force: true }); }
  }));
};
