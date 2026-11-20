const path = require("node:path");
const root = path.resolve(__dirname, "../../..");
module.exports = {
  root,
  docs: path.join(root, "docs"),
  uploads: path.join(root, "uploads"),
  data: path.join(root, ".data"),
  frontend: path.join(root, "src/frontend"),
  public: path.join(root, "src/frontend/public"),
  views: path.join(root, "src/frontend/views"),
};
