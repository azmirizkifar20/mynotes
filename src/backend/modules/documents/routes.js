const fs = require("node:fs");
const path = require("node:path");
const db = require("../../database");
const { parentPath } = require("./paths");
const { uuid, asyncRoute, entry, changed } = require("../../rendering/http");
module.exports = function register(api, { documentData, upload }) {
  api.post(
    "/raw",
    asyncRoute(async (req, res) => {
      const row = await entry(req);
      res.json({
        success: true,
        content: row.content.toString("utf8"),
        revision: row.revision,
      });
    }),
  );
  api.post(
    "/document",
    asyncRoute(async (req, res) => {
      const row = await entry(req);
      res.json({
        success: true,
        ...documentData(row, req.baseUrl.replace(/\/api$/, "")),
      });
    }),
  );
  api.post(
    "/share",
    asyncRoute(async (req, res) => {
      const visibility = req.body.visibility;
      if (
        visibility !== undefined &&
        !["public", "private"].includes(visibility)
      )
        throw db.fail(400, "Pengaturan akses tidak valid.");
      const row = await db.transaction(async (client) => {
        const row = await db.get(req.body.filePath, client);
        if (row.kind !== "doc") throw db.fail(400, "Pilih dokumen Markdown.");
        if (visibility !== undefined) {
          await client.query(
            "UPDATE mdpreview.entries SET visibility=$2 WHERE id=$1",
            [row.id, visibility],
          );
          row.visibility = visibility;
          await db.audit(
            "FILE_ACCESS",
            `${row.path}: ${visibility}`,
            req.ip,
            client,
          );
        }
        return row;
      });
      res.json({
        success: true,
        visibility: row.visibility,
        sharePath:
          row.visibility === "public"
            ? req.baseUrl.replace(/\/api$/, "") +
              row.path.split("/").map(encodeURIComponent).join("/")
            : null,
      });
    }),
  );
  api.post(
    "/save",
    asyncRoute(async (req, res) => {
      if (req.body.create !== undefined && typeof req.body.create !== "boolean")
        throw db.fail(400, "Parameter create tidak valid.");
      if (req.body.draftToken && !uuid(req.body.draftToken))
        throw db.fail(400, "Identitas draft tidak valid.");
      const row = await db.save(req.body.filePath, req.body.content, {
        create: Boolean(req.body.create),
        revision: req.body.revision,
        draftToken: req.body.draftToken,
        ip: req.ip,
      });
      changed(res, {
        ...documentData(row, req.baseUrl.replace(/\/api$/, "")),
        message: "File berhasil disimpan",
      });
    }),
  );
  api.post(
    "/create-folder",
    asyncRoute(async (req, res) => {
      await db.createFolder(req.body.folderPath, req.ip);
      changed(res);
    }),
  );
  api.post(
    "/rename",
    asyncRoute(async (req, res) => {
      const row = await db.get(req.body.path);
      let name = req.body.newName;
      if (typeof name !== "string" || name.includes("/") || name.includes("\\"))
        throw db.fail(400, "Nama tidak valid.");
      name = name.trim();
      if (row.kind === "doc" && !/\.md$/i.test(name)) name += ".md";
      const destination = parentPath(row.path).replace(/\/$/, "") + "/" + name;
      await db.move(row.path, destination, req.ip);
      changed(res, { path: destination });
    }),
  );
  api.post(
    "/move",
    asyncRoute(async (req, res) => {
      const row = await db.get(req.body.path);
      const destination =
        typeof req.body.targetFolder === "string"
          ? req.body.targetFolder.replace(/\/$/, "") +
            "/" +
            path.posix.basename(row.path)
          : "";
      await db.move(row.path, destination, req.ip);
      changed(res, { path: destination });
    }),
  );
  api.post(
    "/upload",
    upload.single("file"),
    asyncRoute(async (req, res) => {
      if (!req.file) throw db.fail(400, "Tidak ada file diupload.");
      try {
        const folder = await db.get(req.body.targetFolder);
        if (folder.kind !== "folder")
          throw db.fail(400, "Folder tujuan tidak valid.");
        const name =
          req.body.filename === undefined
            ? req.file.originalname
            : req.body.filename;
        if (
          typeof name !== "string" ||
          name.includes("/") ||
          name.includes("\\")
        )
          throw db.fail(400, "Nama file tidak valid.");
        const normalized = name.replace(/\.markdown$/i, ".md");
        const key = folder.path.replace(/\/$/, "") + "/" + normalized;
        const row = await db.save(key, fs.readFileSync(req.file.path, "utf8"), {
          create: true,
          ip: req.ip,
        });
        changed(res, { path: row.path });
      } finally {
        fs.rmSync(req.file.path, { force: true });
      }
    }),
  );
  api.post(
    "/delete",
    asyncRoute(async (req, res) => {
      if (req.body.force !== undefined && typeof req.body.force !== "boolean")
        throw db.fail(400, "Konfirmasi tidak valid.");
      await db.trash(req.body.path, Boolean(req.body.force), req.ip, req.body.mentionToken);
      changed(res, { message: "Item dipindahkan ke sampah." });
    }),
  );
  api.get(
    "/search",
    asyncRoute(async (req, res) => {
      const text = String(req.query.q || "")
        .trim()
        .slice(0, 200);
      if (!text) return res.json({ success: true, items: [] });
      const rows = (
        await db.query(
          `SELECT id,path,kind,CASE WHEN kind='doc' THEN ts_headline('simple',convert_from(content,'UTF8'),websearch_to_tsquery('simple',$1),'StartSel="",StopSel="",MaxWords=35,MinWords=15,MaxFragments=1') ELSE '' END AS snippet,ts_rank(search_vector,websearch_to_tsquery('simple',$1)) AS rank FROM mdpreview.entries WHERE deleted_at IS NULL AND kind IN ('doc','folder') AND path <> '/' AND path !~* '^/(steering|superpowers)(/|$)' AND (search_vector @@ websearch_to_tsquery('simple',$1) OR strpos(lower(path),lower($1))>0) ORDER BY rank DESC,path LIMIT 50`,
          [text],
        )
      ).rows;
      res.json({ success: true, items: rows });
    }),
  );
};
