const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { Client } = require('pg');
const config = require('../db-config');
const vm = require('node:vm');

// A generated database keeps this check away from the shared workspace.
const name = 'mdpreview_check_' + randomUUID().replace(/-/g, '');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mdpreview-check-'));
const root = path.resolve(__dirname, '..');
let db, server, admin, created = false;
async function main() {
  const searchUI = vm.createContext({ escape: value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])) });
  vm.runInContext(fs.readFileSync(path.join(root, 'public/workspace-tools.js'), 'utf8'), searchUI);
  assert.equal(searchUI.highlightSearch('GIMMICK_REQUEST', 'gimmick_request'), '<mark>GIMMICK_REQUEST</mark>');
  assert.equal(searchUI.highlightSearch('gimmick and request', 'gimmick_request'), '<mark>gimmick</mark> and <mark>request</mark>');
  assert.equal(searchUI.highlightSearch('<img onerror="boom"> a+b', 'a+b'), '&lt;img onerror=&quot;boom&quot;&gt; <mark>a+b</mark>');
  const managementNodes = Object.fromEntries(['main', 'outline', 'management-content', 'management-error', 'tool-dialog'].map(id => [id, { innerHTML: '', textContent: '', open: false }]));
  Object.assign(searchUI, { URLSearchParams, location: { search: '' }, navigationSequence: 0, $: id => managementNodes[id], icon: () => '', api: async () => ({ items: [] }) });
  for (const [view, title] of [['trash', 'Sampah'], ['templates', 'Template'], ['activity', 'Aktivitas']]) {
    searchUI.current = view; searchUI.location.search = '?view=' + view;
    assert.equal(searchUI.requestedView(), view);
    await searchUI.renderManagementPage(view);
    assert.ok(managementNodes.main.innerHTML.includes('<h1>' + title + '</h1>'));
    assert.equal(managementNodes['tool-dialog'].open, false);
  }
  searchUI.location.search = '?view=constructor';
  assert.equal(searchUI.requestedView(), null);
  searchUI.api = async () => { throw new Error('Offline'); };
  await searchUI.renderManagementPage('activity');
  assert.equal(managementNodes['management-error'].textContent, 'Offline');
  assert.match(managementNodes['management-content'].innerHTML, /Coba lagi/);
  const liveUI = vm.createContext({ current: 'note', pages: [{ id: 'note', body: '# Original' }], editing: false, saving: false, $: () => null, scheduleDraft: () => {} });
  vm.runInContext(fs.readFileSync(path.join(root, 'public/live-editor.js'), 'utf8'), liveUI);
  vm.runInContext("documentBuffer = { id: 'note', content: '# Original' }", liveUI);
  liveUI.changeDocumentContent('# Inline edit');
  assert.equal(liveUI.documentContent(), '# Inline edit');
  liveUI.editing = true; liveUI.changeDocumentContent('# Markdown edit');
  assert.equal(liveUI.documentContent(), '# Markdown edit');
  vm.runInContext("editing = false; liveEditor = { getValue: () => '# Latest keystroke' }; liveEditorReady = true; liveEditorTouched = true", liveUI);
  assert.equal(liveUI.documentContent(), '# Latest keystroke');
  liveUI.current = 'other';
  liveUI.changeDocumentContent('# Wrong document');
  assert.equal(vm.runInContext('documentBuffer.content', liveUI), '# Latest keystroke');
  admin = new Client(config('postgres')); await admin.connect();
  assert.match(name, /^mdpreview_check_[a-f0-9]{32}$/);
  assert.notEqual(name, process.env.DB_NAME);
  const { validPath } = require('../document-path');
  assert.equal(validPath('/CON.md'), false);
  assert.equal(validPath('/../secret.md'), false);
  await admin.query('CREATE DATABASE "' + name + '"'); created = true;
  process.env.DB_NAME = name;
  db = require('../database');
  const snapshot = path.join(temporary, 'snapshot');
  fs.mkdirSync(path.join(snapshot, 'docs', 'Projects'), { recursive: true });
  fs.writeFileSync(path.join(snapshot, 'docs', 'Public.md'), '# Public\n\n![image](image.png)');
  fs.writeFileSync(path.join(snapshot, 'docs', 'Private.md'), '# Private secret');
  fs.writeFileSync(path.join(snapshot, 'docs', 'Search.md'), '# Search\n\n' + 'Opening words. '.repeat(100) + 'Use gimmick_request to create a new request.');
  fs.writeFileSync(path.join(snapshot, 'docs', 'image.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
  const share = 'a'.repeat(48);
  fs.writeFileSync(path.join(snapshot, 'file-access.json'), JSON.stringify({ '/Private.md': { id: share, visibility: 'private' } }));
  execFileSync(process.execPath, [path.join(root, 'scripts/import-server-docs.js'), '--server-snapshot', snapshot], { cwd: root, env: process.env, windowsHide: true, stdio: 'pipe' });
  assert.equal((await db.get('/Private.md')).visibility, 'private');
  assert.equal((await db.get('/Private.md')).share_id, share);
  assert.equal((await db.get('/Public.md')).visibility, 'public');
  await db.createFolder('/projects/Sub');
  assert.equal((await db.get('/projects/sub')).path, '/Projects/Sub');
  const row = await db.save('/projects/sub/Note.md', '# First', { create: true });
  assert.equal(row.path, '/Projects/Sub/Note.md');
  assert.equal(row.visibility, 'private');
  await assert.rejects(db.save(row.path, '# Stale', { revision: 0 }), error => error.status === 409);
  const token = randomUUID();
  await db.query('INSERT INTO mdpreview.drafts(entry_id,content,base_revision,token) VALUES($1,$2,1,$3)', [row.id, '# Draft', token]);
  await assert.rejects(db.save(row.path, '# Unsafe', { revision: 1 }), error => error.status === 409);
  const saved = await db.save(row.path, '# Second', { revision: 1, draftToken: token });
  assert.equal(saved.revision, 2);
  assert.equal((await db.query('SELECT 1 FROM mdpreview.drafts WHERE entry_id=$1', [row.id])).rowCount, 0);
  assert.equal((await db.query('SELECT 1 FROM mdpreview.versions WHERE entry_id=$1', [row.id])).rowCount, 2);
  await db.move('/projects/sub', '/projects/Moved');
  assert.equal((await db.get('/Projects/Moved/Note.md')).id, row.id);
  await db.trash('/Projects/Moved', true);
  await assert.rejects(db.get('/Projects/Moved/Note.md'), error => error.status === 404);
  const group = (await db.query('SELECT trash_id FROM mdpreview.entries WHERE id=$1', [row.id])).rows[0].trash_id;
  await db.restoreTrash(group, false);
  assert.equal((await db.get('/Projects/Moved/Note.md')).revision, 2);
  await assert.rejects(db.save('/Projects/Invalid.md', 'NUL\0', { create: true }), error => error.status === 400);

  const appRoot = path.join(temporary, 'app'); fs.mkdirSync(appRoot);
  for (const file of ['server.js', 'database.js', 'db-config.js', 'document-path.js', 'document-sync.js', 'workspace-routes.js', 'db', 'views', 'public']) fs.cpSync(path.join(root, file), path.join(appRoot, file), { recursive: true });
  fs.mkdirSync(path.join(appRoot, 'docs'));
  const port = 18000 + Math.floor(Math.random() * 10000), base = 'http://127.0.0.1:' + port;
  const code = randomUUID(), hash = await require('bcrypt').hash(code, 4);
  server = spawn(process.execPath, ['server.js'], { cwd: appRoot, windowsHide: true, env: { ...process.env, PORT: String(port), NODE_ENV: 'development', NODE_PATH: path.join(root, 'node_modules'), ACCESS_CODE_HASH: hash, SESSION_SECRET: randomUUID() }, stdio: 'ignore' });
  let online = false;
  for (let i = 0; i < 200; i++) {
    if (server.exitCode !== null) throw new Error('Isolated app failed to start');
    try { if ((await fetch(base)).ok) { online = true; break; } } catch {}
    await delay(50);
  }
  assert.ok(online);
  for (const prefix of ['', '/mynotes']) {
    const publicPage = await (await fetch(base + prefix + '/Public.md')).text();
    assert.match(publicPage, /"mode":"public"/);
    assert.ok(publicPage.includes(prefix + '/static/style.css?v='));
    assert.ok(publicPage.includes(prefix + '/static/workspace-tools.js?v='));
    assert.ok(publicPage.includes(prefix + '/static/app.js?v='));
    assert.match(publicPage, /media\?/);
    const privatePage = await (await fetch(base + prefix + '/Private.md')).text();
    assert.match(privatePage, /"mode":"login"/);
    assert.doesNotMatch(privatePage, /Private secret/);
    assert.equal((await fetch(base + prefix + '/share/' + share)).status, 404);
    assert.equal((await fetch(base + prefix + '/api/workspace')).status, 401);
    const login = await fetch(base + prefix + '/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const workspace = await (await fetch(base + prefix + '/api/workspace', { headers: { Cookie: cookie } })).json();
    assert.ok(workspace.success);
    assert.ok(workspace.pages.some(page => page.id === row.id));
    const editablePage = await (await fetch(base + prefix + '/Public.md', { headers: { Cookie: cookie } })).text();
    const editorVersion = require('vditor/package.json').version;
    assert.ok(editablePage.includes(prefix + '/static/editor/' + editorVersion + '/dist/index.min.js'));
    assert.ok(editablePage.includes(prefix + '/static/live-editor.js?v='));
    assert.ok(!publicPage.includes('/dist/index.min.js'));
    for (const asset of ['index.min.js', 'index.css', 'js/lute/lute.min.js', 'js/i18n/en_US.js']) assert.equal((await fetch(base + prefix + '/static/editor/' + editorVersion + '/dist/' + asset)).status, 200);
    const search = await (await fetch(base + prefix + '/api/search?q=gimmick_request', { headers: { Cookie: cookie } })).json();
    assert.ok(search.success);
    assert.match(search.items.find(item => item.path === '/Search.md').snippet, /gimmick_request/);
  }
  console.log('Isolated PostgreSQL workspace checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server && server.exitCode === null) { server.kill(); await once(server, 'exit'); }
  if (db) await db.pool.end();
  if (created) { assert.match(name, /^mdpreview_check_[a-f0-9]{32}$/); await admin.query('DROP DATABASE "' + name + '" WITH (FORCE)'); }
  if (admin) await admin.end();
  fs.rmSync(temporary, { recursive: true, force: true });
});
