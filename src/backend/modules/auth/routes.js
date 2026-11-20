const express = require("express");
const rateLimit = require("express-rate-limit");
const { audit: auditLog } = require("../../database/audit");
const { verifyCode } = require("./service");
const routes = express.Router();
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // max 5 attempts per minute
  message: {
    success: false,
    message: "Terlalu banyak percobaan, coba lagi dalam 1 menit",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
routes.post("/api/verify", verifyLimiter, async (req, res, next) => {
  const { code } = req.body;
  if (!code || typeof code !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "Kode akses harus diisi" });
  }

  try {
    const match = await verifyCode(code);
    if (match) {
      return req.session.regenerate((error) => {
        if (error) return next(error);
        req.session.authenticated = true;
        req.session.cookie.path = req.baseUrl || "/";
        req.session.save((error) => {
          if (error) return next(error);
          auditLog("AUTH_SUCCESS", "Login berhasil", req.ip)
            .then(() => res.json({ success: true }))
            .catch(next);
        });
      });
    }
    await auditLog("AUTH_FAIL", "Login gagal", req.ip);
    return res
      .status(403)
      .json({ success: false, message: "Kode akses salah" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal error" });
  }
});

// API: logout
routes.post("/api/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("mdprev.sid", { path: req.baseUrl || "/" });
    return res.json({ success: true });
  });
});

module.exports = routes;
