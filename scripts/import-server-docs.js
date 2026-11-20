const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const db = require('../database');
const { validPath } = require('../document-path');

(async () => {
  if (process.argv[2] !== '--server-snapshot' || !process.argv[3]) throw new Error('Usage: node scripts/import-server-docs.js --server-snapshot <snapshot directory>');
  const source = fs.realpathSync(process.argv[3]);
  const docs = path.join(source, 'docs');
  const accessPath = path.join(source, 'file-access.json');
  const access = JSON.parse(fs.readFileSync(accessPath, 'utf8'));
  if (!access || typeof access !== 'object' || Array.isArray(access)) throw new Error('Invalid source access metadata');
  const rows = [{ id: db.ROOT_ID, key: '/', kind: 'folder', modified: fs.statSync(docs).mtime }];
  const seen = new Set(['/']);
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.gitkeep') continue;
      if (entry.isSymbolicLink()) throw new Error('Snapshot contains a symlink');
      const filename = path.join(directory, entry.name);
      const key = '/' + path.relative(docs, filename).split(path.sep).join('/');
      if (!validPath(key) || seen.has(key.toLowerCase())) throw new Error('Snapshot contains an unsafe or case-colliding path');
      seen.add(key.toLowerCase());
      const kind = entry.isDirectory() ? 'folder' : /\.md$/i.test(key) ? 'doc' : 'asset';
      const record = access[key] || { visibility: 'public', id: randomBytes(24).toString('hex') };
      if (!['public', 'private'].includes(record.visibility) || !/^[a-f0-9]{48}$/.test(record.id)) throw new Error('Invalid source access metadata');
      const content = kind === 'folder' ? null : fs.readFileSync(filename);
      if (kind === 'doc') {
        new TextDecoder('utf-8', { fatal: true }).decode(content);
        if (content.includes(0)) throw new Error('Markdown source contains NUL bytes');
      }
      rows.push({ id: randomUUID(), key, kind, content, modified: fs.statSync(filename).mtime, record });
      if (kind === 'folder') walk(filename);
    }
  }
  walk(docs);
  await db.initialize();
  await db.transaction(async client => {
    if ((await client.query("SELECT 1 FROM mdpreview.settings WHERE key='server_import'")).rowCount) throw new Error('Workspace already imported; refusing to overwrite it');
    if ((await client.query('SELECT 1 FROM mdpreview.entries LIMIT 1')).rowCount) throw new Error('Workspace is not empty');
    for (const row of rows) {
      await client.query("INSERT INTO mdpreview.entries(id,path,kind,content,visibility,share_id,modified,search_vector) VALUES($1,$2,$3,$4,$5,$6,$7,to_tsvector('simple',$2 || ' ' || $8))", [row.id, row.key, row.kind, row.content || null, row.record?.visibility || 'private', row.kind === 'doc' ? row.record.id : null, row.modified, row.kind === 'doc' ? row.content.toString('utf8').replace(/\0/g, '') : '']);
      if (row.kind === 'doc') await db.snapshot(client, { id: row.id, kind: row.kind, revision: 1, content: row.content, modified: row.modified });
    }
    await client.query("INSERT INTO mdpreview.settings(key,value) VALUES('server_import',$1)", [JSON.stringify({ importedAt: new Date().toISOString(), entries: rows.length, source: 'homeserver' })]);
    await db.audit('SERVER_IMPORT', `${rows.length} entries imported from homeserver snapshot`, null, client);
  });
  console.log('Server snapshot imported:', rows.length, 'entries;', rows.filter(row => row.kind === 'doc').length, 'Markdown documents.');
})().catch(error => { console.error('Import failed:', error.code || error.message); process.exitCode = 1; }).finally(() => db.pool.end());
