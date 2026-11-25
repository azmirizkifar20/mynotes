import express from "express";
import fs from "node:fs";
import path from "node:path";
import { createHash, type Hash } from "node:crypto";
import morgan from "morgan";
import multer from "multer";
import env from "./config/env";
import paths from "./config/paths";
import { readFrontendAssets } from "./rendering/frontend-assets";
import registerTaskBoard from "./modules/task-board/http";
const { documentData } = require("./modules/documents/markdown");
const app = express();
app.set("view engine", "ejs");
app.set("views", paths.views);
app.set("trust proxy", "loopback");
function hashAssets(directory: string, hash: Hash): Hash {
  for (const name of fs.readdirSync(directory).sort()) {
    const filename = path.join(directory, name);
    if (fs.statSync(filename).isDirectory()) hashAssets(filename, hash);
    else if (/\.(js|css|svg)$/.test(name))
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
app.locals.frontendAssets = readFrontendAssets(paths.root);
const passkeyBrowserRoot = path.resolve(
  path.dirname(require.resolve("@simplewebauthn/browser")),
  "..",
);
app.locals.passkeyBrowserVersion = JSON.parse(
  fs.readFileSync(path.join(passkeyBrowserRoot, "package.json"), "utf8"),
).version;
const routes = express.Router();
app.use("/mynotes", routes);
app.use(routes);
routes.use((req, res, next) => {
  res.locals.basePath = req.baseUrl;
  next();
});
routes.use(
  "/static/app",
  express.static(path.join(paths.root, "dist/frontend"), { maxAge: "1y", immutable: true }),
);
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
routes.use(
  "/static/passkeys/" + app.locals.passkeyBrowserVersion,
  express.static(path.join(passkeyBrowserRoot, "esm"), {
    maxAge: "1y",
    immutable: true,
  }),
);
routes.use(express.json({ limit: env.jsonBodyLimit }));
routes.use(require("./middleware/session"));
routes.use(require("./modules/auth/store").normalizeSession);
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
  "documents/image-routes",
  "documents/trash-routes",
  "documents/history",
  "documents/drafts",
  "workspace/routes",
  "templates/routes",
  "activity/routes",
  "task-board/attachment-routes",
  "sticky-notes/routes",
])
  require("./modules/" + feature)(api, context);
registerTaskBoard(api);
api.use((req, res) =>
  res.status(404).json({ success: false, message: "API tidak ditemukan" }),
);
routes.use("/api", api);
routes.use(require("./modules/documents/public-routes"));
routes.use(require("./middleware/error-handler"));
export default app;
