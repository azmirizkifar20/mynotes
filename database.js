const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const { Pool } = require('pg');
const config = require('./db-config');
const { validPath, parentPath, hiddenFromListing } = require('./document-path');
const pool = new Pool({ ...config(), max: 8, idleTimeoutMillis: 10000 });
pool.on('error', error => console.error('Database pool error:', error.code || error.name));
const ROOT_ID = '00000000-0000-0000-0000-000000000000';
const fail = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });
const query = (sql, values) => pool.query(sql, values);

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7827026)');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw fail(409, 'Nama atau lokasi tersebut sudah digunakan.');
    throw error;
  } finally { client.release(); }
}
async function initialize() {
  await transaction(async client => {
    await client.query(fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8'));
    const templates = [
      ['Catatan meeting', '# Catatan meeting\n\n## Tanggal\n\n## Peserta\n\n## Pembahasan\n\n## Keputusan\n\n## Tindak lanjut\n- [ ] \n'],
      ['Progress harian', '# Progress harian\n\n## Selesai\n\n## Kendala\n\n## Berikutnya\n'],
      ['Dokumentasi API', '# Dokumentasi API\n\n## Endpoint\n\n## Autentikasi\n\n## Request\n```json\n{}\n```\n\n## Response\n```json\n{}\n```\n\n## Error\n']
    ];
    if (!(await client.query("SELECT 1 FROM mdpreview.settings WHERE key='templates_seeded'")).rowCount) {
      for (const [name, content] of templates) await client.query('INSERT INTO mdpreview.templates(id,name,content) VALUES($1,$2,$3)', [randomUUID(), name, content]);
      await client.query("INSERT INTO mdpreview.settings VALUES('templates_seeded','true')");
    }
  });
}
async function ready() {
  if (!(await query("SELECT 1 FROM mdpreview.settings WHERE key='server_import' ")).rowCount) throw fail(503, 'Dokumen server belum dimigrasikan.');
}
async function get(key, client = pool) {
  if (!validPath(key)) throw fail(400, 'Path tidak valid.');
  const row = (await client.query('SELECT * FROM mdpreview.entries WHERE lower(path)=lower($1) AND deleted_at IS NULL', [key])).rows[0];
  if (!row) throw fail(404, 'Halaman tidak ditemukan.');
  return row;
}
const pageId = row => row.path === '/' ? 'home' : row.id;
function page(row, ids) {
  return { id: pageId(row), path: row.path, title: row.path === '/' ? 'Ruang kerja' : path.posix.basename(row.path).replace(row.kind === 'doc' ? /\.md$/i : /$^/, ''),
    type: row.kind, parent: row.path === '/' ? null : ids.get(parentPath(row.path)) || 'home', modified: row.modified.toISOString(),
    revision: row.revision, visibility: row.visibility,
    description: row.kind === 'doc' ? 'Catatan dan dokumentasi Markdown.' : 'Dokumentasi dan catatan dalam folder ini.' };
}
async function workspace() {
  const rows = (await query("SELECT id,path,kind,revision,modified,visibility FROM mdpreview.entries WHERE deleted_at IS NULL AND kind IN ('folder','doc') ORDER BY path")).rows.filter(row => !hiddenFromListing(row.path));
  const ids = new Map(rows.map(row => [row.path, pageId(row)]));
  return rows.map(row => page(row, ids));
}
async function audit(action, detail, ip, client = pool) {
  await client.query('INSERT INTO mdpreview.audit(action,detail,ip) VALUES($1,$2,$3)', [action, detail, ip || null]);
}
async function snapshot(client, row) {
  if (row.kind === 'doc') await client.query('INSERT INTO mdpreview.versions(entry_id,revision,content,saved_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [row.id, row.revision, row.content, row.modified]);
}
async function save(key, content, options = {}) {
  if (!validPath(key) || !/\.md$/i.test(key) || typeof content !== 'string' || content.includes('\0') || Buffer.byteLength(content) > 5 * 1024 * 1024) throw fail(400, 'Dokumen Markdown tidak valid atau melebihi 5 MB.');
  return transaction(async client => {
    const existing = (await client.query('SELECT * FROM mdpreview.entries WHERE lower(path)=lower($1) AND deleted_at IS NULL', [key])).rows[0];
    if (existing && (options.create || existing.kind !== 'doc')) throw fail(409, 'File dengan nama ini sudah ada.');
    if (!existing && !options.create) throw fail(404, 'Dokumen tidak ditemukan.');
    const parent = await get(parentPath(key), client);
    if (parent.kind !== 'folder') throw fail(400, 'Folder tujuan tidak valid.');
    key = existing?.path || parent.path.replace(/\/$/, '') + '/' + path.posix.basename(key);
    if (existing && existing.revision !== options.revision) throw fail(409, 'Dokumen berubah di perangkat lain. Tulisanmu tetap di editor; buka versi terbaru sebelum menyimpan.', { conflict: true });
    if (existing) {
      const draft = (await client.query('SELECT token FROM mdpreview.drafts WHERE entry_id=$1', [existing.id])).rows[0];
      if ((draft?.token || null) !== (options.draftToken || null)) throw fail(409, 'Draft berubah di perangkat lain. Salin tulisanmu sebelum memuat ulang dokumen.', { conflict: true });
    }
    const buffer = Buffer.from(content);
    let row;
    if (existing) {
      await snapshot(client, existing);
      row = (await client.query("UPDATE mdpreview.entries SET content=$2,revision=revision+1,modified=now(),search_vector=to_tsvector('simple',path || ' ' || $3) WHERE id=$1 RETURNING *", [existing.id, buffer, content])).rows[0];
      if (options.draftToken) await client.query('DELETE FROM mdpreview.drafts WHERE entry_id=$1 AND token=$2', [row.id, options.draftToken]);
    } else {
      row = (await client.query("INSERT INTO mdpreview.entries(id,path,kind,content,visibility,share_id,search_vector) VALUES($1,$2,'doc',$3,'private',$4,to_tsvector('simple',$2 || ' ' || $5)) RETURNING *", [randomUUID(), key, buffer, randomBytes(24).toString('hex'), content])).rows[0];
    }
    await snapshot(client, row);
    await audit(existing ? 'FILE_SAVE' : 'FILE_CREATE', key, options.ip, client);
    return row;
  });
}
async function createFolder(key, ip) {
  if (!validPath(key) || key === '/') throw fail(400, 'Path folder tidak valid.');
  return transaction(async client => {
    const parent = await get(parentPath(key), client);
    if (parent.kind !== 'folder') throw fail(400, 'Folder tujuan tidak valid.');
    key = parent.path.replace(/\/$/, '') + '/' + path.posix.basename(key);
    await client.query("INSERT INTO mdpreview.entries(id,path,kind) VALUES($1,$2,'folder')", [randomUUID(), key]);
    await audit('FOLDER_CREATE', key, ip, client);
  });
}
async function move(from, to, ip) {
  if (!validPath(from) || !validPath(to) || from === '/' || to === '/' || to.toLowerCase().startsWith(from.toLowerCase() + '/')) throw fail(400, 'Lokasi tujuan tidak valid.');
  return transaction(async client => {
    const row = await get(from, client);
    if (row.kind === 'asset') throw fail(400, 'Hanya folder atau dokumen yang dapat dipindahkan.');
    if (row.kind === 'doc' && !/\.md$/i.test(to)) throw fail(400, 'Nama file harus berakhiran .md.');
    const parent = await get(parentPath(to), client);
    if (parent.kind !== 'folder') throw fail(400, 'Folder tujuan tidak valid.');
    to = parent.path.replace(/\/$/, '') + '/' + path.posix.basename(to);
    await client.query("UPDATE mdpreview.entries SET path=$2 || substr(path,length($1)+1),modified=now(),search_vector=to_tsvector('simple',$2 || substr(path,length($1)+1) || ' ' || CASE WHEN kind='doc' THEN convert_from(content,'UTF8') ELSE '' END) WHERE deleted_at IS NULL AND (path=$1 OR starts_with(path,$1 || '/'))", [row.path, to]);
    await audit('MOVE', `${row.path} -> ${to}`, ip, client);
    return to;
  });
}
async function trash(key, force, ip) {
  if (!validPath(key) || key === '/') throw fail(400, 'Path tidak valid.');
  return transaction(async client => {
    const row = await get(key, client);
    if (row.kind === 'folder' && !force && (await client.query('SELECT 1 FROM mdpreview.entries WHERE deleted_at IS NULL AND starts_with(path,$1) LIMIT 1', [row.path + '/'])).rowCount) throw fail(409, 'Folder masih berisi item. Konfirmasi pemindahan semua isi ke sampah.', { requiresConfirm: true });
    const group = randomUUID();
    await client.query("UPDATE mdpreview.entries SET deleted_at=now(),trash_id=$2 WHERE deleted_at IS NULL AND (path=$1 OR starts_with(path,$1 || '/'))", [row.path, group]);
    await audit('TRASH', row.path, ip, client);
  });
}
async function restoreTrash(group, permanently, ip) {
  return transaction(async client => {
    const rows = (await client.query('SELECT * FROM mdpreview.entries WHERE trash_id=$1 AND deleted_at IS NOT NULL ORDER BY length(path)', [group])).rows;
    if (!rows.length) throw fail(404, 'Item sampah tidak ditemukan.');
    if (permanently) await client.query('DELETE FROM mdpreview.entries WHERE trash_id=$1 AND deleted_at IS NOT NULL', [group]);
    else {
      const parent = await get(parentPath(rows[0].path), client);
      if (parent.kind !== 'folder') throw fail(409, 'Pulihkan folder induknya terlebih dahulu.');
      const destination = parent.path.replace(/\/$/, '') + '/' + path.posix.basename(rows[0].path);
      await client.query('UPDATE mdpreview.entries SET path=$2 || substr(path,length($3)+1),deleted_at=NULL,trash_id=NULL WHERE trash_id=$1', [group, destination, rows[0].path]);
    }
    await audit(permanently ? 'PURGE' : 'TRASH_RESTORE', rows[0].path, ip, client);
  });
}
async function preferences() {
  const rows = (await query("SELECT id,favorite,opened_at FROM mdpreview.entries WHERE deleted_at IS NULL AND (favorite OR opened_at IS NOT NULL) AND path !~* '^/(steering|superpowers)(/|$)' ORDER BY opened_at DESC NULLS LAST")).rows;
  const settings = (await query("SELECT key,value FROM mdpreview.settings WHERE key IN ('theme','preferences_imported')")).rows;
  return { favorites: rows.filter(row => row.favorite).map(row => row.id === ROOT_ID ? 'home' : row.id),
    recent: rows.filter(row => row.opened_at).slice(0, 50).map(row => row.id), ...Object.fromEntries(settings.map(row => [row.key, row.value])) };
}

module.exports = { pool, query, transaction, initialize, ready, get, pageId, workspace, save, createFolder, move, trash, restoreTrash,
  audit, snapshot, preferences, fail, ROOT_ID };
