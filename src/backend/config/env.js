const paths = require("./paths");
require("dotenv").config({
  path: require("node:path").join(paths.root, ".env"),
});
module.exports = {
  port: process.env.PORT || 8026,
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || "5mb",
  uploadFileSizeLimit: 5 * 1024 * 1024,
  accessCodeHash: process.env.ACCESS_CODE_HASH || "",
  sessionSecret: process.env.SESSION_SECRET || "fallback-secret-change-me",
  production: process.env.NODE_ENV === "production",
};
