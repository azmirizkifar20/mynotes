const path = require("node:path");
const { root } = require("../../config/paths");
const register = require(path.join(root, "dist/server/backend/modules/task-board/http")).default;
module.exports = (router) => register(router);
