const express = require("express");
const rateLimit = require("express-rate-limit");
const requireAuth = require("../../middleware/require-auth");
const { asyncRoute } = require("../../rendering/http");
const { audit } = require("../../database/audit");
const renderPage = require("../../rendering/page");
const config = require("./config");
const store = require("./store");
const passkeys = require("./passkeys");
const { login } = require("./session");
const routes = express.Router();
const attempts = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak percobaan. Coba lagi dalam 5 menit.",
  },
});
const optionsLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak permintaan. Tunggu satu menit.",
  },
});
const claimLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Terlalu banyak permintaan login." },
});

routes.get("/", (req, res, next) => {
  if (req.query.auth !== "1") return next();
  try {
    config.requireCanonical(req);
    renderPage(res, { mode: "login" });
  } catch (error) {
    next(error);
  }
});
routes.post(
  "/api/auth/status",
  optionsLimit,
  asyncRoute(async (req, res) =>
    res.json({ success: true, ...(await passkeys.status(req)) }),
  ),
);
routes.post(
  "/api/auth/setup",
  attempts,
  asyncRoute(async (req, res) => {
    await passkeys.setup(req);
    await audit("PASSKEY_SETUP", "Izin pendaftaran passkey", req.ip);
    res.json({ success: true });
  }),
);
for (const [type, generate, verify] of [
  ["register", passkeys.registrationOptions, passkeys.verifyRegistration],
  ["login", passkeys.authenticationOptions, passkeys.verifyAuthentication],
]) {
  routes.post(
    "/api/auth/" + type + "/options",
    optionsLimit,
    asyncRoute(async (req, res) =>
      res.json({ success: true, ...(await generate(req)) }),
    ),
  );
  routes.post(
    "/api/auth/" + type + "/verify",
    attempts,
    asyncRoute(async (req, res) => {
      let result;
      try {
        result = await verify(req);
      } catch (error) {
        await audit("AUTH_FAIL", "Verifikasi passkey gagal", req.ip);
        throw error;
      }
      await login(req, result.id);
      await audit(
        type === "register" ? "PASSKEY_REGISTER" : "AUTH_SUCCESS",
        type === "register" ? "Passkey terdaftar" : "Login passkey",
        req.ip,
      );
      res.json({ success: true, completion: result.completion });
    }),
  );
}
routes.post(
  "/api/auth/bridge/start",
  optionsLimit,
  asyncRoute(async (req, res) =>
    res.json({ success: true, ...(await passkeys.startBridge(req)) }),
  ),
);
routes.post(
  "/api/auth/bridge/claim",
  claimLimit,
  asyncRoute(async (req, res) => {
    const id = await passkeys.claimBridge(req);
    await login(req, id);
    await audit("AUTH_SUCCESS", "Login melalui pusat passkey", req.ip);
    res.json({ success: true, pending: false });
  }),
);
routes.post("/api/verify", (req, res) =>
  res
    .status(410)
    .json({
      success: false,
      message: "Login kode akses sudah diganti dengan passkey.",
    }),
);
routes.get(
  "/api/passkeys",
  requireAuth,
  asyncRoute(async (req, res) => {
    config.requestApp(req);
    res.json({
      success: true,
      authURL: config.authURL,
      items: (await store.keys()).map((key) => ({
        id: key.id,
        name: key.name,
        created_at: key.created_at,
        last_used_at: key.last_used_at,
        backed_up: key.backed_up,
        current: key.id === req.session.passkeyId,
      })),
    });
  }),
);
routes.post(
  "/api/passkeys/rename",
  requireAuth,
  asyncRoute(async (req, res) => {
    config.requestApp(req);
    await store.freshSession(req);
    const { id, name } = req.body;
    if (
      typeof id !== "string" ||
      id.length > 4096 ||
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 80 ||
      /[\x00-\x1f]/.test(name)
    )
      throw store.fail(400, "Nama passkey tidak valid.");
    const result = await store.query(
      "UPDATE mdpreview.passkeys SET name=$2 WHERE id=$1 AND rp_id=$3",
      [id, name.trim(), config.rpID],
    );
    if (!result.rowCount) throw store.fail(404, "Passkey tidak ditemukan.");
    await audit("PASSKEY_RENAME", name.trim(), req.ip);
    res.json({ success: true });
  }),
);
routes.post(
  "/api/passkeys/delete",
  requireAuth,
  asyncRoute(async (req, res) => {
    config.requestApp(req);
    await store.freshSession(req);
    const { id, confirm } = req.body;
    if (typeof id !== "string" || id.length > 4096 || confirm !== true)
      throw store.fail(400, "Konfirmasi penghapusan diperlukan.");
    await store.transaction(async (client) => {
      const keys = await store.keys(client);
      if (!keys.some((key) => key.id === id))
        throw store.fail(404, "Passkey tidak ditemukan.");
      if (keys.length <= 1)
        throw store.fail(
          409,
          "Tambahkan passkey lain sebelum menghapus passkey terakhir.",
        );
      await client.query(
        "DELETE FROM mdpreview.passkeys WHERE id=$1 AND rp_id=$2",
        [id, config.rpID],
      );
    });
    await audit("PASSKEY_DELETE", "Passkey dicabut", req.ip);
    res.json({ success: true, loggedOut: id === req.session.passkeyId });
  }),
);
routes.post("/api/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("mdprev.sid", { path: req.baseUrl || "/" });
    res.json({ success: true });
  });
});
module.exports = routes;
