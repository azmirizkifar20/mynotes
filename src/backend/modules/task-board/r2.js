const { createHash } = require("node:crypto");
const { createReadStream } = require("node:fs");
const { finished } = require("node:stream/promises");
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { taskAttachmentSizeLimit } = require("../../config/env");
const { fail } = require("../../database/connection");

const prefix = "md-preview/task-attachments/";
const configured = () => ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"].every((key) => Boolean(process.env[key]?.trim()));
let client;
function connection() {
  if (!configured()) throw fail(503, "Penyimpanan lampiran R2 belum dikonfigurasi.");
  if (!client) {
    const endpoint = new URL(process.env.R2_ENDPOINT);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== "/")
      throw fail(503, "Konfigurasi endpoint R2 tidak valid.");
    client = new S3Client({
      region: "auto", endpoint: endpoint.href,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
      requestChecksumCalculation: "WHEN_REQUIRED",
      maxAttempts: 2, requestHandler: { connectionTimeout: 10000, requestTimeout: 120000 },
    });
  }
  return client;
}
const bucket = () => { connection(); return process.env.R2_BUCKET; };
const key = (taskId, id, filename) => prefix + taskId + "/" + id + "/" + filename;
async function send(Command, Bucket, Key, extra = {}) {
  if (Key && !Key.startsWith(prefix)) throw new Error("Invalid attachment object prefix");
  return connection().send(new Command({ Bucket, ...(Key ? { Key } : {}), ...extra }), { abortSignal: AbortSignal.timeout(180000) });
}
async function put(Bucket, Key, source) {
  const buffered = Buffer.isBuffer(source), body = buffered ? source : createReadStream(source.path);
  try {
    await send(PutObjectCommand, Bucket, Key, {
      Body: body, ContentLength: buffered ? source.length : source.size, ContentType: "application/octet-stream",
      ContentMD5: buffered ? createHash("md5").update(source).digest("base64") : source.md5,
    });
  } finally {
    if (!buffered) { body.destroy(); await finished(body, { cleanup: true }).catch(() => {}); }
  }
}
async function get(Bucket, Key) {
  const response = await send(GetObjectCommand, Bucket, Key);
  const chunks = [];
  let length = 0;
  try {
    for await (const chunk of response.Body) {
      length += chunk.length;
      if (length > taskAttachmentSizeLimit) throw new Error("Attachment object exceeds size limit");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } finally { response.Body.destroy(); }
}
const remove = (Bucket, Key) => send(DeleteObjectCommand, Bucket, Key);
const check = () => send(HeadBucketCommand, bucket());
const viewType = (filename) => ({
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", avif: "image/avif", bmp: "image/bmp",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  mkv: "video/x-matroska", avi: "video/x-msvideo",
  md: "text/plain; charset=utf-8", markdown: "text/plain; charset=utf-8", csv: "text/plain; charset=utf-8",
})[filename.split(".").pop().toLowerCase()] || "application/octet-stream";
async function view(Bucket, Key, filename) {
  if (!Key.startsWith(prefix)) throw new Error("Invalid attachment object prefix");
  return getSignedUrl(connection(), new GetObjectCommand({
    Bucket, Key, ResponseContentType: viewType(filename), ResponseContentDisposition: "inline",
    ResponseCacheControl: "private, no-store",
  }), { expiresIn: 900 });
}
module.exports = { configured, bucket, prefix, key, put, get, remove, check, view, viewType };
