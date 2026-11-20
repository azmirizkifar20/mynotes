const fs = require("node:fs/promises");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const db = require("../../database");
const { validPath } = require("./paths");
const paths = require("../../config/paths");
const root = paths.docs;
const manifestPath = path.join(paths.data, "mirror.json");
let pending;

async function target(key) {
  if (!validPath(key)) throw new Error("Unsafe database mirror path");
  let cursor = root;
  try {
    if ((await fs.lstat(root)).isSymbolicLink())
      throw new Error("Symlink at document mirror root");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const part of key.split("/").filter(Boolean)) {
    cursor = path.join(cursor, part);
    try {
      if ((await fs.lstat(cursor)).isSymbolicLink())
        throw new Error("Symlink in document mirror");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return cursor;
}
async function atomicWrite(filename, content) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temporary = path.join(
    path.dirname(filename),
    ".mirror-" + randomBytes(10).toString("hex"),
  );
  try {
    await fs.writeFile(temporary, content, { flag: "wx", mode: 0o600 });
    await fs.rename(temporary, filename);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
async function materialize() {
  await db.ready();
  const rows = (
    await db.query(
      "SELECT id,path,kind,revision,content,modified FROM mdpreview.entries WHERE deleted_at IS NULL ORDER BY length(path),path",
    )
  ).rows;
  let previous = [];
  try {
    previous = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const active = new Map(rows.map((row) => [row.path, row]));
  const old = new Map(previous.map((row) => [row.path, row]));
  // Remove only paths owned by this mirror; unrelated local tooling is preserved.
  for (const row of previous.sort((a, b) => b.path.length - a.path.length)) {
    if (row.path === "/" || active.get(row.path)?.kind === row.kind) continue;
    const filename = await target(row.path);
    try {
      if (row.kind === "folder") await fs.rmdir(filename);
      else await fs.unlink(filename);
    } catch (error) {
      if (!["ENOENT", "ENOTEMPTY"].includes(error.code)) throw error;
    }
  }
  for (const row of rows) {
    const filename = await target(row.path);
    if (row.kind === "folder") await fs.mkdir(filename, { recursive: true });
    else {
      const before = old.get(row.path);
      let changed =
        !before || before.id !== row.id || before.revision !== row.revision;
      if (!changed) {
        try {
          changed = !(await fs.readFile(filename)).equals(row.content);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          changed = true;
        }
      }
      if (changed) {
        await atomicWrite(filename, row.content);
        await fs.utimes(filename, row.modified, row.modified);
      }
    }
  }
  await atomicWrite(
    manifestPath,
    JSON.stringify(
      rows.map(({ id, path, kind, revision }) => ({
        id,
        path,
        kind,
        revision,
      })),
    ),
  );
  return rows.length;
}
function sync() {
  if (!pending)
    pending = materialize().finally(() => {
      pending = null;
    });
  return pending;
}
function start() {
  const timer = setInterval(
    () =>
      sync().catch((error) =>
        console.error(
          "Document mirror sync failed:",
          error.code || error.message,
        ),
      ),
    5000,
  );
  timer.unref();
}
module.exports = { sync, start };
