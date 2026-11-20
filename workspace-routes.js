const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const db = require('./database');
const mirror = require('./document-sync');
const { validPath, parentPath, hiddenFromListing } = require('./document-path');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const asyncRoute = work => (req, res, next) => Promise.resolve(work(req, res, next)).catch(next);

module.exports = function workspaceRoutes({ requireAuth, upload, renderPage, renderMarkdown, documentData }) {
  const routes = express.Router();
  const api = express.Router();
  api.use(requireAuth);
  const entry = async req => {
    const row = await db.get(req.body.filePath);
    if (row.kind !== 'doc') throw db.fail(400, 'Pilih dokumen Markdown.');
    return row;
  };
  const syncSoon = () => mirror.sync().catch(error => console.error('Mirror pending:', error.code || error.name));
  const changed = (res, result = {}) => { syncSoon(); return res.json({ success: true, ...result }); };

  api.get('/workspace', asyncRoute(async (req, res) => res.json({ success: true, pages: await db.workspace(), preferences: await db.preferences() })));
  api.post('/raw', asyncRoute(async (req, res) => { const row = await entry(req); res.json({ success: true, content: row.content.toString('utf8'), revision: row.revision }); }));
  api.post('/document', asyncRoute(async (req, res) => {
    const row = await entry(req);
    res.json({ success: true, ...documentData(row, req.baseUrl.replace(/\/api$/, '')) });
  }));
  api.post('/share', asyncRoute(async (req, res) => {
    const visibility = req.body.visibility;
    if (visibility !== undefined && !['public', 'private'].includes(visibility)) throw db.fail(400, 'Pengaturan akses tidak valid.');
    const row = await db.transaction(async client => {
      const row = await db.get(req.body.filePath, client);
      if (row.kind !== 'doc') throw db.fail(400, 'Pilih dokumen Markdown.');
      if (visibility !== undefined) {
        await client.query('UPDATE mdpreview.entries SET visibility=$2 WHERE id=$1', [row.id, visibility]);
        row.visibility = visibility;
        await db.audit('FILE_ACCESS', `${row.path}: ${visibility}`, req.ip, client);
      }
      return row;
    });
    res.json({ success: true, visibility: row.visibility, sharePath: row.visibility === 'public' ? req.baseUrl.replace(/\/api$/, '') + row.path.split('/').map(encodeURIComponent).join('/') : null });
  }));
  api.post('/save', asyncRoute(async (req, res) => {
    if (req.body.create !== undefined && typeof req.body.create !== 'boolean') throw db.fail(400, 'Parameter create tidak valid.');
    if (req.body.draftToken && !uuid(req.body.draftToken)) throw db.fail(400, 'Identitas draft tidak valid.');
    const row = await db.save(req.body.filePath, req.body.content, { create: Boolean(req.body.create), revision: req.body.revision, draftToken: req.body.draftToken, ip: req.ip });
    changed(res, { ...documentData(row, req.baseUrl.replace(/\/api$/, '')), message: 'File berhasil disimpan' });
  }));
  api.post('/create-folder', asyncRoute(async (req, res) => { await db.createFolder(req.body.folderPath, req.ip); changed(res); }));
  api.post('/rename', asyncRoute(async (req, res) => {
    const row = await db.get(req.body.path);
    let name = req.body.newName;
    if (typeof name !== 'string' || name.includes('/') || name.includes('\\')) throw db.fail(400, 'Nama tidak valid.');
    name = name.trim();
    if (row.kind === 'doc' && !/\.md$/i.test(name)) name += '.md';
    const destination = parentPath(row.path).replace(/\/$/, '') + '/' + name;
    await db.move(row.path, destination, req.ip);
    changed(res, { path: destination });
  }));
  api.post('/move', asyncRoute(async (req, res) => {
    const row = await db.get(req.body.path);
    const destination = typeof req.body.targetFolder === 'string' ? req.body.targetFolder.replace(/\/$/, '') + '/' + path.posix.basename(row.path) : '';
    await db.move(row.path, destination, req.ip);
    changed(res, { path: destination });
  }));
  api.post('/upload', upload.single('file'), asyncRoute(async (req, res) => {
    if (!req.file) throw db.fail(400, 'Tidak ada file diupload.');
    try {
      const folder = await db.get(req.body.targetFolder);
      if (folder.kind !== 'folder') throw db.fail(400, 'Folder tujuan tidak valid.');
      const name = req.body.filename === undefined ? req.file.originalname : req.body.filename;
      if (typeof name !== 'string' || name.includes('/') || name.includes('\\')) throw db.fail(400, 'Nama file tidak valid.');
      const normalized = name.replace(/\.markdown$/i, '.md');
      const key = folder.path.replace(/\/$/, '') + '/' + normalized;
      const row = await db.save(key, fs.readFileSync(req.file.path, 'utf8'), { create: true, ip: req.ip });
      changed(res, { path: row.path });
    } finally { fs.rmSync(req.file.path, { force: true }); }
  }));
  api.post('/delete', asyncRoute(async (req, res) => {
    if (req.body.force !== undefined && typeof req.body.force !== 'boolean') throw db.fail(400, 'Konfirmasi tidak valid.');
    await db.trash(req.body.path, Boolean(req.body.force), req.ip);
    changed(res, { message: 'Item dipindahkan ke sampah.' });
  }));
  api.get('/trash', asyncRoute(async (req, res) => {
    const rows = (await db.query('SELECT DISTINCT ON (trash_id) trash_id AS id,path,kind,deleted_at FROM mdpreview.entries WHERE deleted_at IS NOT NULL ORDER BY trash_id,length(path),path')).rows;
    res.json({ success: true, items: rows.sort((a, b) => b.deleted_at - a.deleted_at) });
  }));
  api.post('/trash/restore', asyncRoute(async (req, res) => {
    if (!uuid(req.body.id)) throw db.fail(400, 'Item sampah tidak valid.');
    await db.restoreTrash(req.body.id, false, req.ip); changed(res);
  }));
  api.post('/trash/purge', asyncRoute(async (req, res) => {
    if (!uuid(req.body.id) || req.body.confirm !== true) throw db.fail(400, 'Konfirmasi hapus permanen diperlukan.');
    await db.restoreTrash(req.body.id, true, req.ip); changed(res);
  }));
  api.post('/history', asyncRoute(async (req, res) => {
    const row = await entry(req);
    const items = (await db.query('SELECT revision,saved_at,octet_length(content) AS bytes FROM mdpreview.versions WHERE entry_id=$1 ORDER BY revision DESC LIMIT 100', [row.id])).rows;
    res.json({ success: true, items, revision: row.revision });
  }));
  api.post('/history/preview', asyncRoute(async (req, res) => {
    const row = await entry(req);
    const version = (await db.query('SELECT content,saved_at FROM mdpreview.versions WHERE entry_id=$1 AND revision=$2', [row.id, req.body.version])).rows[0];
    if (!version) throw db.fail(404, 'Versi tidak ditemukan.');
    res.json({ success: true, content: version.content.toString('utf8'), savedAt: version.saved_at });
  }));
  api.post('/history/restore', asyncRoute(async (req, res) => {
    const row = await entry(req);
    const version = (await db.query('SELECT content FROM mdpreview.versions WHERE entry_id=$1 AND revision=$2', [row.id, req.body.version])).rows[0];
    if (!version) throw db.fail(404, 'Versi tidak ditemukan.');
    const saved = await db.save(row.path, version.content.toString('utf8'), { revision: req.body.revision, ip: req.ip });
    changed(res, documentData(saved, req.baseUrl.replace(/\/api$/, '')));
  }));
  api.post('/draft/read', asyncRoute(async (req, res) => {
    const row = await entry(req);
    const draft = (await db.query('SELECT content,base_revision,token,updated_at FROM mdpreview.drafts WHERE entry_id=$1', [row.id])).rows[0] || null;
    res.json({ success: true, draft });
  }));
  api.post('/draft', asyncRoute(async (req, res) => {
    const { content, revision, token } = req.body;
    if (typeof content !== 'string' || content.includes('\0') || Buffer.byteLength(content) > 5 * 1024 * 1024 || (token !== undefined && token !== null && !uuid(token))) throw db.fail(400, 'Draft tidak valid.');
    const result = await db.transaction(async client => {
      const row = await db.get(req.body.filePath, client);
      if (row.kind !== 'doc' || row.revision !== revision) throw db.fail(409, 'Versi dokumen berubah. Salin tulisanmu sebelum memuat versi terbaru.', { conflict: true });
      const before = (await client.query('SELECT token FROM mdpreview.drafts WHERE entry_id=$1', [row.id])).rows[0];
      if ((before?.token || null) !== (token || null)) throw db.fail(409, 'Draft berubah di perangkat lain. Tulisanmu tetap di editor.', { conflict: true });
      const nextToken = randomUUID();
      await client.query('INSERT INTO mdpreview.drafts(entry_id,content,base_revision,token) VALUES($1,$2,$3,$4) ON CONFLICT(entry_id) DO UPDATE SET content=$2,base_revision=$3,token=$4,updated_at=now()', [row.id, content, revision, nextToken]);
      return nextToken;
    });
    res.json({ success: true, token: result });
  }));
  api.post('/draft/discard', asyncRoute(async (req, res) => {
    if (!uuid(req.body.token)) throw db.fail(400, 'Identitas draft tidak valid.');
    const row = await entry(req);
    const result = await db.query('DELETE FROM mdpreview.drafts WHERE entry_id=$1 AND token=$2', [row.id, req.body.token]);
    if (!result.rowCount) throw db.fail(409, 'Draft berubah. Muat ulang sebelum membuangnya.');
    res.json({ success: true });
  }));
  api.get('/preferences', asyncRoute(async (req, res) => res.json({ success: true, preferences: await db.preferences() })));
  api.post('/preferences', asyncRoute(async (req, res) => {
    const { action } = req.body;
    if (action === 'theme') {
      if (!['system', 'light', 'dark'].includes(req.body.value)) throw db.fail(400, 'Tema tidak valid.');
      await db.query("INSERT INTO mdpreview.settings(key,value) VALUES('theme',$1) ON CONFLICT(key) DO UPDATE SET value=$1", [JSON.stringify(req.body.value)]);
    } else if (action === 'favorite' || action === 'opened') {
      const id = req.body.id === 'home' ? db.ROOT_ID : req.body.id;
      if (!uuid(id) || (action === 'favorite' && typeof req.body.value !== 'boolean')) throw db.fail(400, 'Preferensi tidak valid.');
      if (action === 'favorite') await db.query('UPDATE mdpreview.entries SET favorite=$2 WHERE id=$1 AND deleted_at IS NULL', [id, req.body.value]);
      else await db.query("UPDATE mdpreview.entries SET opened_at=now() WHERE id=$1 AND kind='doc' AND deleted_at IS NULL", [id]);
    } else throw db.fail(400, 'Aksi preferensi tidak valid.');
    res.json({ success: true, preferences: await db.preferences() });
  }));
  api.post('/preferences/import', asyncRoute(async (req, res) => {
    const favorites = req.body.favorites, recent = req.body.recent;
    if (!Array.isArray(favorites) || !Array.isArray(recent) || favorites.length > 1000 || recent.length > 1000 || ![...favorites, ...recent].every(validPath)) throw db.fail(400, 'Preferensi browser tidak valid.');
    await db.transaction(async client => {
      if ((await client.query("SELECT 1 FROM mdpreview.settings WHERE key='preferences_imported'")).rowCount) return;
      await client.query('UPDATE mdpreview.entries SET favorite=true WHERE path=ANY($1::text[]) AND deleted_at IS NULL', [favorites]);
      for (const [index, key] of recent.entries()) await client.query("UPDATE mdpreview.entries SET opened_at=now()-($2::integer * interval '1 second') WHERE path=$1 AND deleted_at IS NULL AND kind='doc'", [key, index]);
      await client.query("INSERT INTO mdpreview.settings VALUES('preferences_imported','true')");
    });
    res.json({ success: true, preferences: await db.preferences() });
  }));
  api.get('/search', asyncRoute(async (req, res) => {
    const text = String(req.query.q || '').trim().slice(0, 200);
    if (!text) return res.json({ success: true, items: [] });
    const rows = (await db.query(`SELECT id,path,kind,CASE WHEN kind='doc' THEN ts_headline('simple',convert_from(content,'UTF8'),websearch_to_tsquery('simple',$1),'StartSel="",StopSel="",MaxWords=35,MinWords=15,MaxFragments=1') ELSE '' END AS snippet,ts_rank(search_vector,websearch_to_tsquery('simple',$1)) AS rank FROM mdpreview.entries WHERE deleted_at IS NULL AND kind IN ('doc','folder') AND path <> '/' AND path !~* '^/(steering|superpowers)(/|$)' AND (search_vector @@ websearch_to_tsquery('simple',$1) OR strpos(lower(path),lower($1))>0) ORDER BY rank DESC,path LIMIT 50`, [text])).rows;
    res.json({ success: true, items: rows });
  }));
  api.get('/templates', asyncRoute(async (req, res) => res.json({ success: true, items: (await db.query('SELECT * FROM mdpreview.templates ORDER BY name')).rows })));
  api.post('/templates/save', asyncRoute(async (req, res) => {
    const { id, name, content } = req.body;
    if ((id && !uuid(id)) || typeof name !== 'string' || name.includes('\0') || !name.trim() || name.trim().length > 100 || typeof content !== 'string' || content.includes('\0') || Buffer.byteLength(content) > 5 * 1024 * 1024) throw db.fail(400, 'Template tidak valid.');
    if (id) {
      if (!(await db.query('UPDATE mdpreview.templates SET name=$2,content=$3,modified=now() WHERE id=$1', [id, name.trim(), content])).rowCount) throw db.fail(404, 'Template tidak ditemukan.');
    } else await db.query('INSERT INTO mdpreview.templates(id,name,content) VALUES($1,$2,$3)', [randomUUID(), name.trim(), content]);
    await db.audit('TEMPLATE_SAVE', name.trim(), req.ip);
    res.json({ success: true });
  }));
  api.post('/templates/delete', asyncRoute(async (req, res) => {
    if (!uuid(req.body.id) || req.body.confirm !== true) throw db.fail(400, 'Konfirmasi hapus diperlukan.');
    await db.query('DELETE FROM mdpreview.templates WHERE id=$1', [req.body.id]);
    await db.audit('TEMPLATE_DELETE', req.body.id, req.ip); res.json({ success: true });
  }));
  api.get('/activity', asyncRoute(async (req, res) => res.json({ success: true, items: (await db.query('SELECT action,detail,created_at FROM mdpreview.audit ORDER BY id DESC LIMIT 100')).rows })));
  api.use((req, res) => res.status(404).json({ success: false, message: 'API tidak ditemukan' }));
  routes.use('/api', api);

  routes.get('/media', asyncRoute(async (req, res) => {
    let document, image;
    try { document = await db.get(req.query.document); image = await db.get(req.query.file); }
    catch { return res.sendStatus(404); }
    if (document.kind !== 'doc' || image.kind !== 'asset' || !/\.(png|jpe?g|gif|webp|avif)$/i.test(image.path) || (!req.session?.authenticated && document.visibility !== 'public')) return res.sendStatus(404);
    const images = new Set(); renderMarkdown(document.content.toString('utf8'), document.path, images);
    if (!images.has(image.path)) return res.sendStatus(404);
    res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); res.type(path.posix.extname(image.path)); res.send(image.content);
  }));
  routes.get('/share/:id', asyncRoute(async (req, res) => {
    const row = /^[a-f0-9]{48}$/.test(req.params.id) && (await db.query("SELECT * FROM mdpreview.entries WHERE share_id=$1 AND visibility='public' AND deleted_at IS NULL AND kind='doc'", [req.params.id])).rows[0];
    if (!row) return renderPage(res, { mode: 'unavailable', message: 'Link tidak tersedia', description: 'File ini privat, sudah dihapus, atau link tidak valid.' }, 404);
    renderPage(res, { mode: 'public', document: { title: path.posix.basename(row.path).replace(/\.md$/i, ''), ...documentData(row, req.baseUrl) } });
  }));
  routes.get('*', asyncRoute(async (req, res) => {
    let key;
    try { key = decodeURIComponent(req.path).replace(/\/$/, '') || '/'; }
    catch { return renderPage(res, { mode: 'unavailable', message: 'Path tidak valid' }, 400); }
    if (!validPath(key)) return renderPage(res, { mode: 'unavailable', message: 'Path tidak valid' }, 403);
    let row;
    try { row = await db.get(key); }
    catch (error) { if (error.status === 404) return renderPage(res, { mode: 'unavailable', message: 'Halaman tidak ditemukan' }, 404); throw error; }
    if (!req.session?.authenticated) {
      if (row.kind !== 'doc' || row.visibility !== 'public') return renderPage(res, { mode: 'login' });
      return renderPage(res, { mode: 'public', document: { title: path.posix.basename(row.path).replace(/\.md$/i, ''), ...documentData(row, req.baseUrl) } });
    }
    if (row.kind === 'asset') {
      if (!/\.(png|jpe?g|gif|webp|avif)$/i.test(row.path)) return res.sendStatus(404);
      res.set('Cache-Control', 'no-store'); res.type(path.posix.extname(row.path)); return res.send(row.content);
    }
    renderPage(res, { mode: 'workspace', pages: await db.workspace(), preferences: await db.preferences(), current: hiddenFromListing(row.path) ? 'home' : db.pageId(row) });
  }));
  return routes;
};
