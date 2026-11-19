require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Marked } = require('marked');
const { markedHighlight } = require('marked-highlight');
const hljs = require('highlight.js');
const rateLimit = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');
const session = require('express-session');
const bcrypt = require('bcrypt');
const morgan = require('morgan');
const multer = require('multer');
const { randomBytes } = require('node:crypto');
const access = require('./file-access');

// Batas ukuran body request.
// Default body-parser hanya 100kb, sehingga menyimpan file .md berukuran lebih
// besar (mis. dokumentasi 200-500 KB) gagal dengan PayloadTooLargeError / HTTP 413.
// Nilai ini juga harus selaras dengan client_max_body_size di nginx.
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '5mb';
const UPLOAD_FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: UPLOAD_FILE_SIZE_LIMIT, files: 1 }
});

const app = express();
const routes = express.Router();
app.use('/mynotes', routes);
app.use(routes);
routes.use((req, res, next) => { res.locals.basePath = req.baseUrl; next(); });
const PORT = process.env.PORT || 8026;
const DOCS_ROOT = fs.realpathSync.native(path.join(__dirname, 'docs'));
const ACCESS_CODE_HASH = process.env.ACCESS_CODE_HASH || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-secret-change-me';

// Audit log setup
const auditLogPath = path.join(__dirname, 'audit.log');
function auditLog(action, detail, ip) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${ip}] ${action}: ${detail}\n`;
  fs.appendFileSync(auditLogPath, line);
}

// Configure marked with syntax highlighting
const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    }
  })
);

// Sanitize options for rendered markdown
const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'pre', 'code', 'span', 'table', 'thead', 'tbody',
    'tr', 'th', 'td', 'hr', 'br', 'del', 'input'
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'a': ['href', 'title', 'target', 'rel'],
    'code': ['class'],
    'span': ['class'],
    'pre': ['class'],
    'input': ['type', 'checked', 'disabled'],
    'th': ['align'],
    'td': ['align']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard'
};

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Trust proxy (behind nginx)
app.set('trust proxy', 1);

// Request logging
routes.use(morgan('combined', {
  stream: fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })
}));

// Static assets
routes.use('/static', express.static(path.join(__dirname, 'public')));

// Parse JSON bodies.
// Limit eksplisit 5mb (default body-parser hanya 100kb) supaya menyimpan file
// .md berukuran besar tidak gagal 413. Ubah lewat env JSON_BODY_LIMIT bila perlu.
routes.use(express.json({ limit: JSON_BODY_LIMIT }));

// Session middleware
routes.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'mdprev.sid',
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 60 * 1000 // 30 minutes
  }
}));

routes.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (req.get('origin') && req.get('origin') !== `${req.protocol}://${req.get('host')}`) {
    return res.status(403).json({ success: false, message: 'Asal request tidak diizinkan' });
  }
  next();
});

// Rate limiting for verify endpoint
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // max 5 attempts per minute
  message: { success: false, message: 'Terlalu banyak percobaan, coba lagi dalam 1 menit' },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware: check if authenticated via session
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Sesi tidak valid, silakan login ulang' });
}

// Security: resolve path and ensure it stays within DOCS_ROOT
function safePath(requestPath) {
  if (typeof requestPath !== 'string' || !requestPath.startsWith('/') || /[\\\x00-\x1f]/.test(requestPath)) return null;
  const parts = requestPath.split('/').filter(Boolean);
  if (parts.length && ['api', 'static', 'share', 'media'].includes(parts[0].toLowerCase())) return null;
  if (parts.some(part => part.startsWith('.') || /[<>:"|?*]/.test(part) || /[. ]$/.test(part))) return null;
  const resolved = path.resolve(DOCS_ROOT, ...parts);
  const relative = path.relative(DOCS_ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  let cursor = DOCS_ROOT;
  for (const part of parts) {
    cursor = path.join(cursor, part);
    try {
      if (fs.lstatSync(cursor).isSymbolicLink()) return null;
      cursor = fs.realpathSync.native(cursor);
    } catch (error) { if (error.code !== 'ENOENT') return null; }
  }
  return cursor;
}

const isMarkdown = filename => /\.md$/i.test(filename);
const fileKey = filename => '/' + path.relative(DOCS_ROOT, filename).split(path.sep).join('/');
const pageId = key => key === '/' ? 'home' : 'p-' + Buffer.from(key).toString('base64url');
const encodedPath = key => key.split('/').map(encodeURIComponent).join('/');
function renderMarkdown(content, key, images = new Set(), basePath = '') {
  const base = new URL(encodedPath(key), 'http://workspace.local');
  function localUrl(value) {
    if (typeof value !== 'string' || !value) return null;
    try {
      const url = new URL(value, base);
      return url.origin === base.origin ? url : null;
    } catch { return null; }
  }
  return sanitizeHtml(marked.parse(content), { ...sanitizeOptions, transformTags: {
    a(tagName, attribs) {
      const url = localUrl(attribs.href);
      if (url && !attribs.href.startsWith('#')) attribs.href = basePath + url.pathname + url.search + url.hash;
      if (attribs.target === '_blank') attribs.rel = 'noopener noreferrer';
      return { tagName, attribs };
    },
    img(tagName, attribs) {
      const url = localUrl(attribs.src);
      if (url) {
        let image;
        try { image = decodeURIComponent(url.pathname); } catch { image = ''; }
        const filename = safePath(image);
        if (filename && /\.(png|jpe?g|gif|webp|avif)$/i.test(filename)) {
          images.add(fileKey(filename));
          attribs.src = basePath + '/media?' + new URLSearchParams({ document: key, file: fileKey(filename) });
        } else delete attribs.src;
      }
      return { tagName, attribs };
    }
  } });
}

function workspace() {
  const pages = [{ id: 'home', path: '/', title: 'Ruang kerja', type: 'folder', parent: null,
    description: 'Tempat untuk merapikan dokumentasi proyek, menyimpan catatan, dan melanjutkan ide.' }];
  function walk(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .filter(entry => !entry.name.startsWith('.') && !entry.isSymbolicLink() && (entry.isDirectory() || isMarkdown(entry.name)))
      .filter(entry => directory !== DOCS_ROOT || !entry.isDirectory() || !['steering', 'superpowers'].includes(entry.name.toLowerCase()))
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    for (const entry of entries) {
      const filename = path.join(directory, entry.name);
      const key = fileKey(filename);
      if (!safePath(key)) continue;
      const folder = entry.isDirectory();
      pages.push({ id: pageId(key), path: key, title: folder ? entry.name : entry.name.replace(/\.md$/i, ''),
        type: folder ? 'folder' : 'doc', parent: pageId(fileKey(directory)),
        modified: fs.statSync(filename).mtime.toISOString(),
        description: folder ? 'Dokumentasi dan catatan dalam folder ini.' : 'Catatan dan dokumentasi Markdown.',
        ...(!folder ? { visibility: access.get(key).visibility } : {}) });
      if (folder) walk(filename);
    }
  }
  walk(DOCS_ROOT);
  return pages;
}

function documentData(filename, basePath = '') {
  const content = fs.readFileSync(filename, 'utf8');
  return { content, html: renderMarkdown(content, fileKey(filename), undefined, basePath), modified: fs.statSync(filename).mtime.toISOString() };
}

function renderPage(res, bootstrap, status = 200) {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  return res.status(status).render('layout', { bootstrap: JSON.stringify({ ...bootstrap, basePath: res.locals.basePath }).replace(/</g, '\\u003c') });
}

// API: verify access code (rate limited)
routes.post('/api/verify', verifyLimiter, async (req, res, next) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, message: 'Kode akses harus diisi' });
  }

  try {
    const match = await bcrypt.compare(code, ACCESS_CODE_HASH);
    if (match) {
      return req.session.regenerate(error => {
        if (error) return next(error);
        req.session.authenticated = true;
        req.session.cookie.path = req.baseUrl || '/';
        req.session.save(error => {
          if (error) return next(error);
          auditLog('AUTH_SUCCESS', 'Login berhasil', req.ip);
          return res.json({ success: true });
        });
      });
    }
    auditLog('AUTH_FAIL', 'Login gagal', req.ip);
    return res.status(403).json({ success: false, message: 'Kode akses salah' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// API: logout
routes.post('/api/logout', (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('mdprev.sid', { path: req.baseUrl || '/' });
    return res.json({ success: true });
  });
});

// API: get raw file content for editing
routes.post('/api/raw', requireAuth, (req, res) => {
  const { filePath } = req.body;
  const resolved = safePath(filePath);
  if (!resolved || !isMarkdown(resolved)) {
    return res.status(400).json({ success: false, message: 'Path tidak valid' });
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return res.status(404).json({ success: false, message: 'File tidak ditemukan' });
  }
  const content = fs.readFileSync(resolved, 'utf-8');
  return res.json({ success: true, content });
});

routes.get('/api/workspace', requireAuth, (req, res) => res.json({ success: true, pages: workspace() }));

routes.post('/api/document', requireAuth, (req, res) => {
  const resolved = safePath(req.body.filePath);
  if (!resolved || !isMarkdown(resolved)) return res.status(400).json({ success: false, message: 'Path file tidak valid' });
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return res.status(404).json({ success: false, message: 'File tidak ditemukan' });
  return res.json({ success: true, ...documentData(resolved, req.baseUrl) });
});

routes.post('/api/share', requireAuth, (req, res) => {
  const resolved = safePath(req.body.filePath);
  const visibility = req.body.visibility;
  if (!resolved || !isMarkdown(resolved) || (visibility !== undefined && !['public', 'private'].includes(visibility))) {
    return res.status(400).json({ success: false, message: 'Pengaturan akses tidak valid' });
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return res.status(404).json({ success: false, message: 'File tidak ditemukan' });
  const key = fileKey(resolved);
  let record = access.get(key);
  if (visibility !== undefined || !record.id) record = access.set(key, visibility || record.visibility);
  if (visibility !== undefined) auditLog('FILE_ACCESS', `${key}: ${visibility}`, req.ip);
  return res.json({ success: true, visibility: record.visibility, sharePath: record.visibility === 'public' ? req.baseUrl + encodedPath(key) : null });
});

// API: save file (create or edit)
routes.post('/api/save', requireAuth, (req, res) => {
  const { filePath, content } = req.body;
  const resolved = safePath(filePath);
  if (!resolved || !isMarkdown(resolved) || typeof content !== 'string' || (req.body.create !== undefined && typeof req.body.create !== 'boolean')) {
    return res.status(400).json({ success: false, message: 'Path tidak valid, harus file .md' });
  }
  const exists = fs.existsSync(resolved);
  if (exists && (req.body.create || !fs.statSync(resolved).isFile())) return res.status(409).json({ success: false, message: 'File dengan nama ini sudah ada' });
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!exists) access.set(fileKey(resolved), 'private');
  const temporary = path.join(dir, '.save-' + randomBytes(12).toString('hex'));
  try {
    fs.writeFileSync(temporary, content, { encoding: 'utf-8', flag: 'wx' });
    fs.renameSync(temporary, resolved);
  } finally { fs.rmSync(temporary, { force: true }); }
  auditLog('FILE_SAVE', filePath, req.ip);
  return res.json({ success: true, message: 'File berhasil disimpan', ...documentData(resolved, req.baseUrl) });
});

// API: create folder
routes.post('/api/create-folder', requireAuth, (req, res) => {
  const { folderPath } = req.body;
  const resolved = safePath(folderPath);
  if (!resolved || resolved === DOCS_ROOT) {
    return res.status(400).json({ success: false, message: 'Path tidak valid' });
  }
  const folderName = path.basename(resolved);
  if (folderName.startsWith('.')) {
    return res.status(400).json({ success: false, message: 'Nama folder tidak boleh diawali titik' });
  }
  if (fs.existsSync(resolved)) {
    return res.status(400).json({ success: false, message: 'Folder sudah ada' });
  }
  fs.mkdirSync(resolved, { recursive: true });
  auditLog('FOLDER_CREATE', folderPath, req.ip);
  return res.json({ success: true, message: 'Folder berhasil dibuat' });
});

routes.post('/api/rename', requireAuth, (req, res) => {
  const { path: targetPath, newName } = req.body;
  const resolved = safePath(targetPath);
  if (!resolved || resolved === DOCS_ROOT || !fs.existsSync(resolved)) {
    return res.status(400).json({ success: false, message: 'Path tidak valid' });
  }
  if (!newName || typeof newName !== 'string') {
    return res.status(400).json({ success: false, message: 'Nama baru harus diisi' });
  }
  const trimmedName = newName.trim();
  if (!trimmedName || trimmedName.includes('/') || trimmedName.includes('\\') || trimmedName.startsWith('.')) {
    return res.status(400).json({ success: false, message: 'Nama tidak valid' });
  }
  const parentDir = path.dirname(resolved);
  const isMdFile = isMarkdown(resolved);
  if (!fs.statSync(resolved).isDirectory() && !isMdFile) return res.status(400).json({ success: false, message: 'Hanya file Markdown yang dapat diubah' });
  const nextPath = path.join(parentDir, isMdFile ? (isMarkdown(trimmedName) ? trimmedName : `${trimmedName}.md`) : trimmedName);
  if (!safePath(fileKey(nextPath))) return res.status(400).json({ success: false, message: 'Nama tidak valid' });
  if (fs.existsSync(nextPath)) {
    return res.status(400).json({ success: false, message: 'Target sudah ada' });
  }
  const from = fileKey(resolved), to = fileKey(nextPath);
  access.prepareRename(from, to);
  fs.renameSync(resolved, nextPath);
  access.remove(from);
  auditLog('RENAME', `${targetPath} -> ${path.relative(DOCS_ROOT, nextPath)}`, req.ip);
  return res.json({ success: true, message: 'Berhasil diubah nama', path: to });
});

// API: upload file
routes.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  const { targetFolder } = req.body;
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Tidak ada file diupload' });
  }
  try {
    const resolved = safePath(targetFolder);
    if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return res.status(400).json({ success: false, message: 'Target folder tidak valid' });
    }
    if (req.body.filename !== undefined && typeof req.body.filename !== 'string') return res.status(400).json({ success: false, message: 'Nama file tidak valid' });
    const name = (req.body.filename || req.file.originalname).replace(/\.markdown$/i, '.md');
    const targetPath = path.join(resolved, name);
    if (!isMarkdown(name) || name !== path.basename(name) || !safePath(fileKey(targetPath))) {
      return res.status(400).json({ success: false, message: 'Pilih file Markdown dengan nama yang valid' });
    }
    if (fs.existsSync(targetPath)) return res.status(409).json({ success: false, message: 'File dengan nama sama sudah ada' });
    access.set(fileKey(targetPath), 'private');
    fs.copyFileSync(req.file.path, targetPath, fs.constants.COPYFILE_EXCL);
    auditLog('FILE_UPLOAD', fileKey(targetPath), req.ip);
    return res.json({ success: true, message: 'File berhasil diupload', path: fileKey(targetPath) });
  } finally {
    fs.rmSync(req.file.path, { force: true });
  }
});

routes.post('/api/delete', requireAuth, (req, res) => {
  const { path: targetPath, force } = req.body;
  const resolved = safePath(targetPath);
  if (!resolved || resolved === DOCS_ROOT || (force !== undefined && typeof force !== 'boolean')) {
    return res.status(400).json({ success: false, message: 'Path tidak valid' });
  }
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ success: false, message: 'Target tidak ditemukan' });
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(resolved);
    if (entries.length > 0 && !force) {
      return res.status(409).json({ success: false, requiresConfirm: true, message: 'Folder masih berisi isi. Konfirmasi sekali lagi untuk menghapus.' });
    }
    if (entries.length > 0 && force) {
      fs.rmSync(resolved, { recursive: true, force: true });
    } else {
      fs.rmdirSync(resolved);
    }
    auditLog('FOLDER_DELETE', targetPath, req.ip);
    access.remove(fileKey(resolved));
    return res.json({ success: true, message: 'Folder berhasil dihapus' });
  }

  fs.unlinkSync(resolved);
  access.remove(fileKey(resolved));
  auditLog('FILE_DELETE', targetPath, req.ip);
  return res.json({ success: true, message: 'File berhasil dihapus' });
});

routes.get('/media', (req, res) => {
  const document = safePath(req.query.document), image = safePath(req.query.file);
  if (!document || !image || !isMarkdown(document) || !/\.(png|jpe?g|gif|webp|avif)$/i.test(image) ||
      !fs.existsSync(document) || !fs.statSync(document).isFile() || !fs.existsSync(image) || !fs.statSync(image).isFile()) return res.sendStatus(404);
  if (!req.session?.authenticated && access.get(fileKey(document)).visibility !== 'public') return res.sendStatus(404);
  const images = new Set();
  renderMarkdown(fs.readFileSync(document, 'utf8'), fileKey(document), images);
  if (!images.has(fileKey(image))) return res.sendStatus(404);
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  return res.sendFile(image, { cacheControl: false, lastModified: false });
});

// Public share URLs never include a workspace index or private document payload.
routes.get('/share/:id', (req, res) => {
  const match = /^[a-f0-9]{48}$/.test(req.params.id) && access.entries().find(([key, value]) => {
    const filename = safePath(key);
    return value.id === req.params.id && value.visibility === 'public' && filename && isMarkdown(filename) && fs.existsSync(filename) && fs.statSync(filename).isFile();
  });
  if (!match) return renderPage(res, { mode: 'unavailable', message: 'Link tidak tersedia', description: 'File ini privat, sudah dihapus, atau link tidak valid.' }, 404);
  const [key] = match;
  return renderPage(res, { mode: 'public', document: { title: path.basename(key).replace(/\.md$/i, ''), ...documentData(safePath(key), req.baseUrl) } });
});

routes.use('/api', (req, res) => res.status(404).json({ success: false, message: 'API tidak ditemukan' }));

routes.get('*', (req, res) => {
  let key;
  try { key = decodeURIComponent(req.path); } catch { return renderPage(res, { mode: 'unavailable', message: 'Path tidak valid' }, 400); }
  const filename = safePath(key);
  if (!filename) return renderPage(res, { mode: 'unavailable', message: 'Path tidak valid' }, 403);
  if (!fs.existsSync(filename)) return renderPage(res, { mode: 'unavailable', message: 'Halaman tidak ditemukan' }, 404);
  key = fileKey(filename);
  const authenticated = Boolean(req.session?.authenticated);
  const directory = fs.statSync(filename).isDirectory();
  if (!authenticated) {
    if (directory || access.get(key).visibility === 'private' || !isMarkdown(filename)) return renderPage(res, { mode: 'login' });
    return renderPage(res, { mode: 'public', document: { title: path.basename(key).replace(/\.md$/i, ''), ...documentData(filename, req.baseUrl) } });
  }
  if (!directory && !isMarkdown(filename)) {
    if (!/\.(png|jpe?g|gif|webp|avif)$/i.test(filename)) return res.status(404).send('File tidak tersedia');
    res.set('Cache-Control', 'no-store');
    return res.sendFile(filename, { cacheControl: false, lastModified: false });
  }
  return renderPage(res, { mode: 'workspace', pages: workspace(), current: pageId(key) });
});

// ===== Error handlers (harus di paling akhir, setelah semua route) =====

// Payload terlalu besar (413) dan error body-parser lainnya.
// Tanpa handler ini Express menampilkan stack trace lengkap ke client.
routes.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({
      success: false,
      message: `Ukuran konten terlalu besar. Maksimal ${JSON_BODY_LIMIT}.`
    });
  }

  if (err && err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `Ukuran file terlalu besar. Maksimal ${Math.round(UPLOAD_FILE_SIZE_LIMIT / 1024 / 1024)} MB.`
      : 'Upload gagal: ' + err.message;
    return res.status(400).json({ success: false, message });
  }

  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Body request bukan JSON yang valid.' });
  }

  console.error('[error]', err && err.stack ? err.stack : err);
  return res.status(err && err.status ? err.status : 500).json({
    success: false,
    message: 'Terjadi kesalahan pada server.'
  });
});

app.listen(PORT, () => {
  console.log(`MD Previewer running on http://localhost:${PORT}`);
  console.log(`JSON body limit: ${JSON_BODY_LIMIT}`);
});
