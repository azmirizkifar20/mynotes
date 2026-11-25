const path = require("node:path");
const { root } = require("./config/paths");
const { start, startupFailed } = require(path.join(root, "dist/server/backend/startup"));
start().catch(startupFailed);
