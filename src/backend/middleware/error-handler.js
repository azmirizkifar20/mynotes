const {
  jsonBodyLimit: JSON_BODY_LIMIT,
  uploadFileSizeLimit: UPLOAD_FILE_SIZE_LIMIT,
} = require("../config/env");
module.exports = (err, req, res, next) => {
  if (err && (err.type === "entity.too.large" || err.status === 413)) {
    return res.status(413).json({
      success: false,
      message: `Ukuran konten terlalu besar. Maksimal ${JSON_BODY_LIMIT}.`,
    });
  }

  if (err && err.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `Ukuran file terlalu besar. Maksimal ${Math.round(UPLOAD_FILE_SIZE_LIMIT / 1024 / 1024)} MB.`
        : "Upload gagal: " + err.message;
    return res.status(400).json({ success: false, message });
  }

  if (err && err.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ success: false, message: "Body request bukan JSON yang valid." });
  }

  console.error("[error]", err && err.stack ? err.stack : err);
  return res.status(err && err.status ? err.status : 500).json({
    success: false,
    message:
      err?.status && err.status < 500
        ? err.message
        : "Terjadi kesalahan pada server.",
    ...(err?.requiresConfirm ? { requiresConfirm: true } : {}),
    ...(err?.conflict ? { conflict: true } : {}),
  });
};
