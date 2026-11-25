const path = require("node:path");
const fs = require("node:fs");
const sourceRoot = path.resolve(__dirname, "../../..");
const root = fs.existsSync(path.join(sourceRoot, "package.json"))
  ? sourceRoot
  : path.resolve(__dirname, "../../../..");
module.exports = {
  root,
  docs: path.join(root, "docs"),
  uploads: path.join(root, "uploads"),
  data: path.join(root, ".data"),
  frontend: path.join(root, "src/frontend"),
  public: path.join(root, "src/frontend/public"),
  views: path.join(root, "src/frontend/views"),
};
