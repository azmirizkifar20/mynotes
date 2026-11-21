const paths = require("./paths");
require("dotenv").config({
  path: require("node:path").join(paths.root, ".env"),
});
const sessionSecret = process.env.SESSION_SECRET;
if (
  !sessionSecret ||
  !sessionSecret.trim() ||
  Buffer.byteLength(sessionSecret, "utf8") < 32
)
  throw new Error("SESSION_SECRET must contain at least 32 bytes of random secret material.");
module.exports = {
  port: process.env.PORT || 8026,
  host: process.env.HOST || "127.0.0.1",
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || "5mb",
  uploadFileSizeLimit: 5 * 1024 * 1024,
  accessCodeHash: process.env.ACCESS_CODE_HASH || "",
  sessionSecret,
  production: process.env.NODE_ENV === "production",
};
