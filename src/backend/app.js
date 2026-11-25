const path = require("node:path");
const { root } = require("./config/paths");
module.exports = require(path.join(root, "dist/server/backend/application")).default;
