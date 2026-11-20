const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const morgan = require("morgan");
const multer = require("multer");
const env = require("./config/env");
const paths = require("./config/paths");
const { documentData } = require("./modules/documents/markdown");
const app = express();
app.set("view engine", "ejs");
app.set("views", paths.views);
app.set("trust proxy", 1);
function hashAssets(directory, hash) {
  for (const name of fs.readdirSync(directory).sort()) {
    const filename = path.join(directory, name);
    if (fs.statSync(filename).isDirectory()) hashAssets(filename, hash);
    else if (/\.(js|css)$/.test(name))
      hash
        .update(path.relative(paths.public, filename).split(path.sep).join("/"))
        .update(fs.readFileSync(filename));
  }
  return hash;
}
app.locals.assetVersion = hashAssets(paths.public, createHash("sha256"))
  .digest("hex")
  .slice(0, 12);
app.locals.editorVersion = require("vditor/package.json").version;
const routes = express.Router();
app.use("/mynotes", routes);
app.use(routes);
routes.use((req, res, next) => {
  res.locals.basePath = req.baseUrl;
  next();
});
routes.use(
  morgan("combined", {
    stream: fs.createWriteStream(path.join(paths.root, "access.log"), {
      flags: "a",
    }),
  }),
);
routes.use(
  "/static/editor/" + app.locals.editorVersion + "/dist",
  express.static(
    path.join(path.dirname(require.resolve("vditor/package.json")), "dist"),
  ),
);
routes.use(
  "/static/v/" + app.locals.assetVersion,
  express.static(paths.public, { maxAge: "1y", immutable: true }),
);
routes.use("/static", express.static(paths.public));
routes.use(express.json({ limit: env.jsonBodyLimit }));
routes.use(require("./middleware/session"));
routes.use("/api", require("./middleware/origin"));
routes.use(require("./modules/auth/routes"));
const api = express.Router();
api.use(require("./middleware/require-auth"));
const upload = multer({
  dest: paths.uploads,
  limits: { fileSize: env.uploadFileSizeLimit, files: 1 },
});
const context = { documentData, upload };
for (const feature of [
  "documents/routes",
  "documents/trash-routes",
  "documents/history",
  "documents/drafts",
  "workspace/routes",
  "templates/routes",
  "activity/routes",
])
  require("./modules/" + feature)(api, context);
api.use((req, res) =>
  res.status(404).json({ success: false, message: "API tidak ditemukan" }),
);
routes.use("/api", api);
routes.use(require("./modules/documents/public-routes"));
routes.use(require("./middleware/error-handler"));
module.exports = app;
