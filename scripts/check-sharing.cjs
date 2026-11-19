const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const bcrypt = require('bcrypt');

async function main() {
  const root = path.resolve(__dirname, '..');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'md-preview-check-'));
  let server, cookie = '';
  const port = 18000 + Math.floor(Math.random() * 10000);
  const base = 'http://127.0.0.1:' + port;
  const code = 'workspace-integration-check';
  const hash = await bcrypt.hash(code, 4);
  for (const name of ['server.js', 'file-access.js', 'views', 'public']) fs.cpSync(path.join(root, name), path.join(temporary, name), { recursive: true });
  fs.mkdirSync(path.join(temporary, 'docs'));
  for (const name of ['steering', 'superpowers']) {
    const directory = path.join(temporary, 'docs', name, 'nested');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'internal.md'), '# Internal');
  }
  fs.writeFileSync(path.join(temporary, 'docs', 'Existing.md'), '# Existing\n\n![Image](image.png)\n\n[Other](other.md)\n\n<a>anchor</a><script>alert(1)</script><img src=x onerror=alert(1)>');
  fs.writeFileSync(path.join(temporary, 'docs', 'other.md'), '# Other');
  fs.writeFileSync(path.join(temporary, 'docs', '.hidden.md'), 'HIDDEN');
  fs.writeFileSync(path.join(temporary, 'docs', 'image.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
  fs.writeFileSync(path.join(temporary, 'docs', 'unreferenced.png'), 'UNREFERENCED');
  async function start() {
    let output = '';
    server = spawn(process.execPath, [path.join(temporary, 'server.js')], { cwd: temporary, windowsHide: true,
      env: { ...process.env, NODE_PATH: path.join(root, 'node_modules'), PORT: String(port), NODE_ENV: 'development', ACCESS_CODE_HASH: hash, SESSION_SECRET: 'isolated-integration-session-secret' }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', chunk => output += chunk); server.stderr.on('data', chunk => output += chunk);
    for (let attempt = 0; attempt < 300; attempt++) {
      if (server.exitCode !== null) throw new Error(output);
      try { const result = await fetch(base); if (result.status === 200) return; } catch {}
      await delay(50);
    }
    throw new Error('Server failed to start (exit=' + server.exitCode + ', pid=' + server.pid + '): ' + output);
  }
  async function stop() { if (server && server.exitCode === null) { server.kill(); await once(server, 'exit'); } }
  async function request(endpoint, body, authenticated = true) {
    const headers = authenticated && cookie ? { Cookie: cookie } : {};
    const options = { headers };
    if (body !== undefined) { options.method = 'POST'; headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
    const response = await fetch(base + endpoint, options);
    return { status: response.status, body: await response.json() };
  }
  async function page(url) {
    const response = await fetch(base + url);
    const html = await response.text();
    const match = html.match(/<script id="bootstrap" type="application\/json">([\s\S]*?)<\/script>/);
    return { status: response.status, html, data: match ? JSON.parse(match[1]) : null };
  }
  async function login() {
    const response = await fetch(base + '/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    assert.equal(response.status, 200); cookie = response.headers.get('set-cookie').split(';')[0];
  }
  try {
    await start();
    assert.equal((await page('/')).data.mode, 'login');
    assert.equal((await page('/Existing.md')).data.mode, 'public');
    for (const route of ['raw', 'document', 'save', 'share', 'create-folder', 'rename', 'delete']) assert.equal((await request('/api/' + route, {}, false)).status, 401);
    assert.equal((await request('/api/workspace', undefined, false)).status, 401);
    await login();
    const initial = await request('/api/workspace');
    assert(!initial.body.pages.some(p => /^\/(steering|superpowers)(\/|$)/i.test(p.path)));
    assert.equal(initial.body.pages.filter(p => p.type === 'doc').length, 2);
    assert(initial.body.pages.filter(p => p.type === 'doc').every(p => p.visibility === 'public'));
    const rendered = await request('/api/document', { filePath: '/Existing.md' });
    assert(!rendered.body.html.includes('<script')); assert(!rendered.body.html.includes('onerror'));
    assert(rendered.body.html.includes('href="/other.md"'));
    const published = await request('/api/share', { filePath: '/Existing.md' });
    const share = published.body.sharePath; assert.equal(share, '/Existing.md');
    const legacyShare = '/share/' + JSON.parse(fs.readFileSync(path.join(temporary, '.data', 'file-access.json'), 'utf8'))['/Existing.md'].id;
    assert.equal((await page(legacyShare)).data.mode, 'public');
    const visitor = await page(share); assert.equal(visitor.data.mode, 'public'); assert(!visitor.data.pages);
    assert(!visitor.html.includes('<script>alert(1)'));
    const media = '/media?' + new URLSearchParams({ document: '/Existing.md', file: '/image.png' });
    assert.equal((await fetch(base + media)).status, 200);
    assert.equal((await fetch(base + '/media?' + new URLSearchParams({ document: '/Existing.md', file: '/unreferenced.png' }))).status, 404);
    const madePrivate = await request('/api/share', { filePath: '/Existing.md', visibility: 'private' });
    assert.equal(madePrivate.body.sharePath, null);
    assert.equal((await page(share)).data.mode, 'login');
    assert.equal((await page(legacyShare)).status, 404);
    const privatePage = await page('/Existing.md'); assert.equal(privatePage.data.mode, 'login'); assert(!privatePage.html.includes('![Image]'));
    if (process.platform === 'win32') assert.equal((await page('/EXISTING.MD')).data.mode, 'login');
    assert.equal((await fetch(base + media)).status, 404);
    assert.equal((await request('/api/share', { filePath: '/Existing.md', visibility: 'invalid' })).status, 400);
    assert.equal((await request('/api/create-folder', { folderPath: '/Project' })).status, 200);
    const draft = { filePath: '/Project/Draft.md', content: '# PRIVATE-ONLY', create: true };
    assert.equal((await request('/api/save', draft)).status, 200);
    assert.equal((await request('/api/save', { ...draft, content: 'OVERWRITTEN' })).status, 409);
    assert.equal((await page('/Project/Draft.md')).data.mode, 'login');
    assert.equal((await request('/api/raw', { filePath: draft.filePath })).body.content, '# PRIVATE-ONLY');
    assert.equal((await request('/api/save', { filePath: '/bad.md', content: {} })).status, 400);
    for (const target of [null, {}, '../escape.md', '/.hidden.md', '/Project/../../escape.md', '/Project\\escape.md', '/name.md:stream', '/share/new.md', '/api/new.md']) assert.equal((await request('/api/raw', { filePath: target })).status, 400);
    assert.equal((await page('/%2ehidden.md')).status, 403);
    assert.equal((await request('/api/delete', { path: '/', force: true })).status, 400);
    const renamed = await request('/api/rename', { path: '/Existing.md', newName: 'Renamed' }); assert.equal(renamed.status, 200);
    assert.equal((await page('/Renamed.md')).data.mode, 'login');
    const republished = await request('/api/share', { filePath: '/Renamed.md', visibility: 'public' }); assert.equal(republished.body.sharePath, '/Renamed.md');
    assert.equal((await page(share)).status, 404);
    assert.equal((await page(republished.body.sharePath)).data.document.title, 'Renamed');
    assert.equal((await page(legacyShare)).data.document.title, 'Renamed');
    const draftShare = await request('/api/share', { filePath: draft.filePath, visibility: 'public' });
    await request('/api/share', { filePath: draft.filePath, visibility: 'private' });
    await request('/api/rename', { path: '/Project', newName: 'Moved' });
    assert.equal((await page('/Moved/Draft.md')).data.mode, 'login');
    assert.equal((await page(draftShare.body.sharePath)).status, 404);
    const navigationPages = (await request('/api/workspace')).body.pages;
    const clientSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
    const breadcrumbTrail = vm.runInNewContext('(' + clientSource.match(/^    function breadcrumbTrail\(id\) \{[\s\S]*?^    \}/m)[0] + ')', { pages: navigationPages });
    const movedDocument = navigationPages.find(p => p.path === '/Moved/Draft.md');
    assert.deepEqual(Array.from(breadcrumbTrail(movedDocument.id), p => p.path), ['/', '/Moved', '/Moved/Draft.md']);
    assert.deepEqual(Array.from(breadcrumbTrail(movedDocument.parent), p => p.path), ['/', '/Moved']);
    assert.deepEqual(Array.from(breadcrumbTrail('home'), p => p.path), ['/']);
    assert.deepEqual(Array.from(breadcrumbTrail('recent'), p => p.id), ['home', 'recent']);
    const form = new FormData(); form.append('targetFolder', '/Moved'); form.append('file', new Blob(['# Imported']), 'Import.markdown');
    const upload = await fetch(base + '/api/upload', { method: 'POST', headers: { Cookie: cookie }, body: form }); assert.equal(upload.status, 200);
    assert.equal((await page('/Moved/Import.md')).data.mode, 'login');
    const unicode = new FormData(); unicode.append('targetFolder', '/Moved'); unicode.append('filename', 'Catatan ü.markdown'); unicode.append('file', new Blob(['# Unicode import']), 'Catatan ü.markdown');
    const unicodeUpload = await fetch(base + '/api/upload', { method: 'POST', headers: { Cookie: cookie }, body: unicode });
    assert.equal((await unicodeUpload.json()).path, '/Moved/Catatan ü.md');
    assert.equal((await page('/Moved/Catatan%20%C3%BC.md')).data.mode, 'login');
    const unicodeShare = await request('/api/share', { filePath: '/Moved/Catatan ü.md', visibility: 'public' });
    assert.equal(unicodeShare.body.sharePath, '/Moved/Catatan%20%C3%BC.md');
    assert.equal((await page(unicodeShare.body.sharePath)).data.mode, 'public');
    const invalid = new FormData(); invalid.append('targetFolder', '/Moved'); invalid.append('file', new Blob(['<script>bad</script>']), 'bad.html');
    assert.equal((await fetch(base + '/api/upload', { method: 'POST', headers: { Cookie: cookie }, body: invalid })).status, 400);
    assert.deepEqual(fs.readdirSync(path.join(temporary, 'uploads')), []);
    await stop(); await start(); await login();
    assert.equal((await page('/Moved/Draft.md')).data.mode, 'login');
    assert.equal((await page(republished.body.sharePath)).data.mode, 'public');
    assert.equal((await page(legacyShare)).data.mode, 'public');
    const movedShare = await request('/api/share', { filePath: '/Moved/Draft.md', visibility: 'public' });
    assert.equal(movedShare.body.sharePath, '/Moved/Draft.md');
    assert.equal((await page(movedShare.body.sharePath)).data.mode, 'public');
    assert.equal((await request('/api/delete', { path: '/Renamed.md' })).status, 200);
    assert.equal((await page(republished.body.sharePath)).status, 404);
    assert.equal((await page(legacyShare)).status, 404);
    assert(!(await request('/api/workspace')).body.pages.some(p => p.path === '/Renamed.md'));
    assert(!JSON.parse(fs.readFileSync(path.join(temporary, '.data', 'file-access.json'), 'utf8'))['/Renamed.md']);
    assert.equal((await request('/api/delete', { path: '/Renamed.md' })).status, 404);
    assert.equal((await request('/api/delete', { path: '/Moved' })).status, 409);
    assert.equal((await request('/api/delete', { path: '/Moved', force: true })).status, 200);
    assert.equal((await page(movedShare.body.sharePath)).status, 404);
    assert.equal((await page(draftShare.body.sharePath)).status, 404);
    assert.equal((await request('/api/logout', {})).status, 200);
    assert.equal((await request('/api/workspace')).status, 401);
    console.log('PASS: auth, workspace, sanitization, public/private access, uploads, images, rename, restart persistence, deletion, invalid paths and logout.');
  } finally {
    await stop();
    assert(temporary.startsWith(path.join(os.tmpdir(), 'md-preview-check-')));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
