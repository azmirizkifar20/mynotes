const path = require("node:path");
const { randomUUID, randomBytes } = require("node:crypto");
const { pool, transaction, fail } = require("../../database/connection");
const { audit } = require("../../database/audit");
const { validPath, parentPath } = require("./paths");
async function get(key, client = pool) {
  if (!validPath(key)) throw fail(400, "Path tidak valid.");
  const row = (
    await client.query(
      "SELECT * FROM mdpreview.entries WHERE lower(path)=lower($1) AND deleted_at IS NULL",
      [key],
    )
  ).rows[0];
  if (!row) throw fail(404, "Halaman tidak ditemukan.");
  return row;
}

const pageId = (row) => (row.path === "/" ? "home" : row.id);

async function snapshot(client, row) {
  if (row.kind === "doc")
    await client.query(
      "INSERT INTO mdpreview.versions(entry_id,revision,content,saved_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [row.id, row.revision, row.content, row.modified],
    );
}

async function save(key, content, options = {}) {
  if (
    !validPath(key) ||
    !/\.md$/i.test(key) ||
    typeof content !== "string" ||
    content.includes("\0") ||
    Buffer.byteLength(content) > 5 * 1024 * 1024
  )
    throw fail(400, "Dokumen Markdown tidak valid atau melebihi 5 MB.");
  return transaction(async (client) => {
    const existing = (
      await client.query(
        "SELECT * FROM mdpreview.entries WHERE lower(path)=lower($1) AND deleted_at IS NULL",
        [key],
      )
    ).rows[0];
    if (existing && (options.create || existing.kind !== "doc"))
      throw fail(409, "File dengan nama ini sudah ada.");
    if (!existing && !options.create)
      throw fail(404, "Dokumen tidak ditemukan.");
    const parent = await get(parentPath(key), client);
    if (parent.kind !== "folder") throw fail(400, "Folder tujuan tidak valid.");
    key =
      existing?.path ||
      parent.path.replace(/\/$/, "") + "/" + path.posix.basename(key);
    if (existing && existing.revision !== options.revision)
      throw fail(
        409,
        "Dokumen berubah di perangkat lain. Tulisanmu tetap di editor; buka versi terbaru sebelum menyimpan.",
        { conflict: true },
      );
    if (existing) {
      const draft = (
        await client.query(
          "SELECT token FROM mdpreview.drafts WHERE entry_id=$1",
          [existing.id],
        )
      ).rows[0];
      if ((draft?.token || null) !== (options.draftToken || null))
        throw fail(
          409,
          "Draft berubah di perangkat lain. Salin tulisanmu sebelum memuat ulang dokumen.",
          { conflict: true },
        );
    }
    const buffer = Buffer.from(content);
    let row;
    if (existing) {
      await snapshot(client, existing);
      row = (
        await client.query(
          "UPDATE mdpreview.entries SET content=$2,revision=revision+1,modified=now(),search_vector=to_tsvector('simple',path || ' ' || $3) WHERE id=$1 RETURNING *",
          [existing.id, buffer, content],
        )
      ).rows[0];
      if (options.draftToken)
        await client.query(
          "DELETE FROM mdpreview.drafts WHERE entry_id=$1 AND token=$2",
          [row.id, options.draftToken],
        );
    } else {
      row = (
        await client.query(
          "INSERT INTO mdpreview.entries(id,path,kind,content,visibility,share_id,search_vector) VALUES($1,$2,'doc',$3,'private',$4,to_tsvector('simple',$2 || ' ' || $5)) RETURNING *",
          [randomUUID(), key, buffer, randomBytes(24).toString("hex"), content],
        )
      ).rows[0];
    }
    await snapshot(client, row);
    await audit(
      existing ? "FILE_SAVE" : "FILE_CREATE",
      key,
      options.ip,
      client,
    );
    return row;
  });
}

async function createFolder(key, ip) {
  if (!validPath(key) || key === "/")
    throw fail(400, "Path folder tidak valid.");
  return transaction(async (client) => {
    const parent = await get(parentPath(key), client);
    if (parent.kind !== "folder") throw fail(400, "Folder tujuan tidak valid.");
    key = parent.path.replace(/\/$/, "") + "/" + path.posix.basename(key);
    await client.query(
      "INSERT INTO mdpreview.entries(id,path,kind) VALUES($1,$2,'folder')",
      [randomUUID(), key],
    );
    await audit("FOLDER_CREATE", key, ip, client);
  });
}

async function savePdf(key, content, options = {}) {
  if (!validPath(key) || !/\.pdf$/i.test(key) || !Buffer.isBuffer(content) ||
      content.length > 5 * 1024 * 1024 || !/^%PDF-[12]\.\d/.test(content.subarray(0, 8).toString("latin1")) ||
      !/%%EOF\s*$/.test(content.subarray(-1024).toString("latin1")))
    throw fail(400, "File PDF tidak valid atau melebihi 5 MB.");
  return transaction(async (client) => {
    const parent = await get(parentPath(key), client);
    if (parent.kind !== "folder") throw fail(400, "Folder tujuan tidak valid.");
    key = parent.path.replace(/\/$/, "") + "/" + path.posix.basename(key);
    const row = (await client.query(
      "INSERT INTO mdpreview.entries(id,path,kind,content,visibility,share_id,search_vector) VALUES($1,$2,'pdf',$3,'private',$4,to_tsvector('simple',$2)) RETURNING *",
      [randomUUID(), key, content, randomBytes(24).toString("hex")],
    )).rows[0];
    await audit("FILE_CREATE", key, options.ip, client);
    return row;
  });
}

async function move(from, to, ip) {
  if (
    !validPath(from) ||
    !validPath(to) ||
    from === "/" ||
    to === "/" ||
    to.toLowerCase().startsWith(from.toLowerCase() + "/")
  )
    throw fail(400, "Lokasi tujuan tidak valid.");
  return transaction(async (client) => {
    const row = await get(from, client);
    if (row.kind === "asset")
      throw fail(400, "Hanya folder atau dokumen yang dapat dipindahkan.");
    if (row.kind === "image" && path.posix.extname(from).toLowerCase().replace(".jpeg", ".jpg") !== path.posix.extname(to).toLowerCase().replace(".jpeg", ".jpg"))
      throw fail(400, "Pertahankan ekstensi gambar saat mengganti nama.");
    if ((row.kind === "doc" && !/\.md$/i.test(to)) || (row.kind === "pdf" && !/\.pdf$/i.test(to)))
      throw fail(400, `Nama file harus berakhiran ${row.kind === "pdf" ? ".pdf" : ".md"}.`);
    const parent = await get(parentPath(to), client);
    if (parent.kind !== "folder") throw fail(400, "Folder tujuan tidak valid.");
    to = parent.path.replace(/\/$/, "") + "/" + path.posix.basename(to);
    await client.query(
      "UPDATE mdpreview.entries SET path=$2 || substr(path,length($1)+1),modified=now(),search_vector=to_tsvector('simple',$2 || substr(path,length($1)+1) || ' ' || CASE WHEN kind='doc' THEN convert_from(content,'UTF8') ELSE '' END) WHERE deleted_at IS NULL AND (path=$1 OR starts_with(path,$1 || '/'))",
      [row.path, to],
    );
    await audit("MOVE", `${row.path} -> ${to}`, ip, client);
    return to;
  });
}
module.exports = { get, pageId, snapshot, save, savePdf, createFolder, move };
