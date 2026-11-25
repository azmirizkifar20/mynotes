const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { transaction, fail } = require("../../database/connection");
const { audit } = require("../../database/audit");
const { get } = require("./service");
const { validPath, parentPath } = require("./paths");

function imageType(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 14 || bytes.length > 5 * 1024 * 1024) return null;
  if (bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) &&
      bytes.toString("latin1", 12, 16) === "IHDR" && bytes.readUInt32BE(16) && bytes.readUInt32BE(20) &&
      bytes.toString("latin1", bytes.length - 8, bytes.length - 4) === "IEND") return "png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length-2] === 255 && bytes[bytes.length-1] === 217) return "jpg";
  if (/^GIF8[79]a$/.test(bytes.toString("latin1", 0, 6)) && bytes.readUInt16LE(6) && bytes.readUInt16LE(8) && bytes[bytes.length-1] === 59) return "gif";
  if (bytes.length >= 30 && bytes.toString("latin1", 0, 4) === "RIFF" && bytes.readUInt32LE(4) + 8 === bytes.length &&
      bytes.toString("latin1", 8, 12) === "WEBP" && ["VP8 ","VP8L","VP8X"].includes(bytes.toString("latin1", 12, 16))) return "webp";
  return null;
}

async function saveImage(documentPath, bytes, ip) {
  const type = imageType(bytes);
  if (!type) throw fail(400, "Gunakan gambar PNG, JPEG, GIF, atau WebP yang valid, maksimal 5 MB.");
  return transaction(async client => {
    const document = await get(documentPath, client);
    if (document.kind !== "doc") throw fail(400, "Upload gambar hanya tersedia pada dokumen Markdown.");
    const filename = "image-" + randomUUID() + "." + type;
    const key = path.posix.join(path.posix.dirname(document.path), filename);
    if (!validPath(key)) throw fail(400, "Lokasi gambar terlalu panjang.");
    await client.query("INSERT INTO mdpreview.entries(id,path,kind,content,visibility) VALUES($1,$2,'asset',$3,'private')", [randomUUID(),key,bytes]);
    await audit("IMAGE_UPLOAD", key, ip, client);
    return { path: key, filename };
  });
}
async function saveWorkspaceImage(key, bytes, options = {}) {
  const type = imageType(bytes);
  const extension = typeof key === "string" ? path.posix.extname(key).toLowerCase().replace(".jpeg", ".jpg") : "";
  if (!validPath(key) || !type || extension !== "." + type)
    throw fail(400, "Gunakan gambar PNG, JPEG, GIF, atau WebP yang valid, maksimal 5 MB, dengan ekstensi yang sesuai.");
  return transaction(async client => {
    const folder = await get(parentPath(key), client);
    if (folder.kind !== "folder") throw fail(400, "Folder tujuan tidak valid.");
    key = folder.path.replace(/\/$/, "") + "/" + path.posix.basename(key);
    const row = (await client.query(
      "INSERT INTO mdpreview.entries(id,path,kind,content,visibility,search_vector) VALUES($1,$2,'image',$3,'private',to_tsvector('simple',$2)) RETURNING *",
      [randomUUID(), key, bytes],
    )).rows[0];
    await audit("IMAGE_UPLOAD", key, options.ip, client);
    return row;
  });
}
module.exports = { imageType, saveImage, saveWorkspaceImage };
