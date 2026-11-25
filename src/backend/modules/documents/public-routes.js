const express = require("express");
const path = require("node:path");
const db = require("../../database");
const { validPath, hiddenFromListing } = require("./paths");
const { asyncRoute } = require("../../rendering/http");
const { renderMarkdown, documentData } = require("./markdown");
const renderPage = require("../../rendering/page");
const routes = express.Router();
routes.get("/share/document/:id", asyncRoute(async (req, res) => {
  const id = req.params.id;
  const row = require("../task-board/validation").uuid(id) && (await db.query(
    "SELECT path,visibility FROM mdpreview.entries WHERE id=$1 AND deleted_at IS NULL AND kind IN ('doc','pdf') AND path !~* '^/(steering|superpowers)(/|$)'",
    [id],
  )).rows[0];
  if (!row) return renderPage(res, { mode: "unavailable", message: "Dokumen tidak tersedia" }, 404);
  res.set("Cache-Control", "no-store");
  if (!req.session?.authenticated && row.visibility !== "public") return renderPage(res, { mode: "login" });
  res.redirect(302, req.baseUrl + row.path.split("/").map(encodeURIComponent).join("/"));
}));
routes.get(
  "/media",
  asyncRoute(async (req, res) => {
    let document, image;
    try {
      document = await db.get(req.query.document);
    } catch {
      return res.sendStatus(404);
    }
    if (document.kind === "pdf") {
      if (!req.session?.authenticated && document.visibility !== "public") return res.sendStatus(404);
      res.set("Cache-Control", "no-store");
      res.set("X-Content-Type-Options", "nosniff");
      res.set("Referrer-Policy", "same-origin");
      res.set("Content-Security-Policy", "frame-ancestors 'self'");
      res.attachment(path.posix.basename(document.path));
      if (req.query.download !== "1") res.set("Content-Disposition", res.get("Content-Disposition").replace(/^attachment/, "inline"));
      return res.type("application/pdf").send(document.content);
    }
    try { image = await db.get(req.query.file); } catch { return res.sendStatus(404); }
    if (
      document.kind !== "doc" ||
      image.kind !== "asset" ||
      !/\.(png|jpe?g|gif|webp|avif)$/i.test(image.path) ||
      (!req.session?.authenticated && document.visibility !== "public")
    )
      return res.sendStatus(404);
    const images = new Set();
    renderMarkdown(document.content.toString("utf8"), document.path, images);
    if (!images.has(image.path)) return res.sendStatus(404);
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.type(path.posix.extname(image.path));
    res.send(image.content);
  }),
);
routes.get(
  "/share/:id",
  asyncRoute(async (req, res) => {
    const row =
      /^[a-f0-9]{48}$/.test(req.params.id) &&
      (
        await db.query(
          "SELECT * FROM mdpreview.entries WHERE share_id=$1 AND visibility='public' AND deleted_at IS NULL AND kind IN ('doc','pdf')",
          [req.params.id],
        )
      ).rows[0];
    if (!row)
      return renderPage(
        res,
        {
          mode: "unavailable",
          message: "Link tidak tersedia",
          description: "File ini privat, sudah dihapus, atau link tidak valid.",
        },
        404,
      );
    renderPage(res, {
      mode: "public",
      document: {
        title: path.posix.basename(row.path).replace(/\.(md|pdf)$/i, ""),
        ...documentData(row, req.baseUrl),
      },
    });
  }),
);
routes.get(
  "*",
  asyncRoute(async (req, res) => {
    let key;
    try {
      key = decodeURIComponent(req.path).replace(/\/$/, "") || "/";
    } catch {
      return renderPage(
        res,
        { mode: "unavailable", message: "Path tidak valid" },
        400,
      );
    }
    if (!validPath(key))
      return renderPage(
        res,
        { mode: "unavailable", message: "Path tidak valid" },
        403,
      );
    let row;
    try {
      row = await db.get(key);
    } catch (error) {
      if (error.status === 404)
        return renderPage(
          res,
          { mode: "unavailable", message: "Halaman tidak ditemukan" },
          404,
        );
      throw error;
    }
    if (!req.session?.authenticated) {
      if (!["doc", "pdf"].includes(row.kind) || row.visibility !== "public")
        return renderPage(res, { mode: "login" });
      return renderPage(res, {
        mode: "public",
        document: {
          title: path.posix.basename(row.path).replace(/\.(md|pdf)$/i, ""),
          ...documentData(row, req.baseUrl),
        },
      });
    }
    if (row.kind === "asset") {
      if (!/\.(png|jpe?g|gif|webp|avif)$/i.test(row.path))
        return res.sendStatus(404);
      res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.type(path.posix.extname(row.path));
      return res.send(row.content);
    }
    renderPage(res, {
      mode: "workspace",
      pages: await db.workspace(),
      preferences: await db.preferences(),
      current: hiddenFromListing(row.path) ? "home" : db.pageId(row),
    });
  }),
);
module.exports = routes;
