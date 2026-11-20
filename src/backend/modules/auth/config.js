require("../../config/env");
const { fail } = require("../../database/connection");

function appURL(value) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && url.hostname === "localhost"))
  )
    throw new Error(
      "Passkey URLs require HTTPS (or http://localhost) without credentials, query or fragment.",
    );
  return url.origin + url.pathname.replace(/\/+$/, "");
}
const authURL = appURL(
  process.env.PASSKEY_AUTH_URL || "https://itsazmi.com/mynotes",
);
const allowedApps = new Set(
  (
    process.env.PASSKEY_APP_URLS ||
    `${authURL},https://mdpreview.azmirf.my.id,https://mdpreview.azmirf.my.id/mynotes,http://localhost:8027,http://localhost:8027/mynotes`
  )
    .split(",")
    .map((value) => appURL(value.trim())),
);
allowedApps.add(authURL);
const origin = new URL(authURL).origin;
const rpID = new URL(authURL).hostname;

function requestApp(req) {
  const value = `${req.protocol}://${req.get("host")}${req.baseUrl || ""}`;
  if (!allowedApps.has(value))
    throw fail(403, "Alamat aplikasi tidak diizinkan untuk autentikasi.");
  if (req.method !== "GET" && req.get("origin") !== new URL(value).origin)
    throw fail(403, "Request autentikasi harus berasal dari halaman aplikasi.");
  return value;
}
function requireCanonical(req) {
  if (requestApp(req) !== authURL)
    throw fail(403, "Gunakan pusat login untuk passkey.");
}
module.exports = {
  appURL,
  authURL,
  allowedApps,
  origin,
  rpID,
  requestApp,
  requireCanonical,
};
