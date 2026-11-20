const path = require("node:path");
const fs = require("node:fs");
const { Marked } = require("marked");
const { markedHighlight } = require("marked-highlight");
const hljs = require("highlight.js");
const sanitizeHtml = require("sanitize-html");
const DOCS_ROOT = fs.realpathSync.native(require("../../config/paths").docs);
const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  }),
);

const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "img",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "pre",
    "code",
    "span",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "hr",
    "br",
    "del",
    "input",
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ["src", "alt", "title", "width", "height"],
    a: ["href", "title", "target", "rel"],
    code: ["class"],
    span: ["class"],
    pre: ["class"],
    input: ["type", "checked", "disabled"],
    th: ["align"],
    td: ["align"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  disallowedTagsMode: "discard",
};

function safePath(requestPath) {
  if (
    typeof requestPath !== "string" ||
    !requestPath.startsWith("/") ||
    /[\\\x00-\x1f]/.test(requestPath)
  )
    return null;
  const parts = requestPath.split("/").filter(Boolean);
  if (
    parts.length &&
    ["api", "static", "share", "media"].includes(parts[0].toLowerCase())
  )
    return null;
  if (
    parts.some(
      (part) =>
        part.startsWith(".") || /[<>:"|?*]/.test(part) || /[. ]$/.test(part),
    )
  )
    return null;
  const resolved = path.resolve(DOCS_ROOT, ...parts);
  const relative = path.relative(DOCS_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  let cursor = DOCS_ROOT;
  for (const part of parts) {
    cursor = path.join(cursor, part);
    try {
      if (fs.lstatSync(cursor).isSymbolicLink()) return null;
      cursor = fs.realpathSync.native(cursor);
    } catch (error) {
      if (error.code !== "ENOENT") return null;
    }
  }
  return cursor;
}

const fileKey = (filename) =>
  "/" + path.relative(DOCS_ROOT, filename).split(path.sep).join("/");

const encodedPath = (key) => key.split("/").map(encodeURIComponent).join("/");

function renderMarkdown(content, key, images = new Set(), basePath = "") {
  const base = new URL(encodedPath(key), "http://workspace.local");
  function localUrl(value) {
    if (typeof value !== "string" || !value) return null;
    try {
      const url = new URL(value, base);
      return url.origin === base.origin ? url : null;
    } catch {
      return null;
    }
  }
  return sanitizeHtml(marked.parse(content), {
    ...sanitizeOptions,
    transformTags: {
      a(tagName, attribs) {
        const url = localUrl(attribs.href);
        if (url && !attribs.href.startsWith("#"))
          attribs.href = basePath + url.pathname + url.search + url.hash;
        if (attribs.target === "_blank") attribs.rel = "noopener noreferrer";
        return { tagName, attribs };
      },
      img(tagName, attribs) {
        const url = localUrl(attribs.src);
        if (url) {
          let image;
          try {
            image = decodeURIComponent(url.pathname);
          } catch {
            image = "";
          }
          const filename = safePath(image);
          if (filename && /\.(png|jpe?g|gif|webp|avif)$/i.test(filename)) {
            images.add(fileKey(filename));
            attribs.src =
              basePath +
              "/media?" +
              new URLSearchParams({ document: key, file: fileKey(filename) });
          } else delete attribs.src;
        }
        return { tagName, attribs };
      },
    },
  });
}

function documentData(row, basePath = "") {
  const content = row.content.toString("utf8");
  const slugs = new Set();
  const html = renderMarkdown(content, row.path, undefined, basePath).replace(
    /<h([1-6])>([\s\S]*?)<\/h\1>/g,
    (match, level, body) => {
      const text = body
        .replace(/<[^>]*>/g, "")
        .replace(/&[^;]+;/g, " ")
        .normalize("NFKD")
        .toLowerCase();
      const base =
        text.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") ||
        "section";
      let slug = base,
        count = 1;
      while (slugs.has(slug)) slug = base + "-" + count++;
      slugs.add(slug);
      return "<h" + level + ' id="' + slug + '">' + body + "</h" + level + ">";
    },
  );
  return {
    content,
    html,
    modified: row.modified.toISOString(),
    revision: row.revision,
  };
}
module.exports = { renderMarkdown, documentData };
