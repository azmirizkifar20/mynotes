require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });
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
const db = require('./database');
const mirror = require('./document-sync');
const PgSession = require('connect-pg-simple')(session);

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
function auditLog(action, detail, ip) {
  return db.audit(action, detail, ip);
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
  store: new PgSession({ pool: db.pool, schemaName: 'mdpreview', tableName: 'sessions' }),
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

const fileKey = filename => '/' + path.relative(DOCS_ROOT, filename).split(path.sep).join('/');
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

function documentData(row, basePath = '') {
  const content = row.content.toString('utf8');
  const slugs = new Set();
  const html = renderMarkdown(content, row.path, undefined, basePath).replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (match, level, body) => {
    const text = body.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').normalize('NFKD').toLowerCase();
    const base = text.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section';
    let slug = base, count = 1;
    while (slugs.has(slug)) slug = base + '-' + count++;
    slugs.add(slug);
    return '<h' + level + ' id="' + slug + '">' + body + '</h' + level + '>';
  });
  return { content, html, modified: row.modified.toISOString(), revision: row.revision };
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
          auditLog('AUTH_SUCCESS', 'Login berhasil', req.ip).then(() => res.json({ success: true })).catch(next);
        });
      });
    }
    await auditLog('AUTH_FAIL', 'Login gagal', req.ip);
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

routes.use(require('./workspace-routes')({ requireAuth, upload, renderPage, renderMarkdown, documentData }));

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
    message: err?.status && err.status < 500 ? err.message : 'Terjadi kesalahan pada server.',
    ...(err?.requiresConfirm ? { requiresConfirm: true } : {}),
    ...(err?.conflict ? { conflict: true } : {})
  });
});

async function start() {
  await db.initialize();
  await db.ready();
  await mirror.sync();
  mirror.start();
  const server = app.listen(PORT, () => console.log('MD Previewer ready on port ' + PORT));
  async function stop() { server.close(async () => { await db.pool.end(); process.exit(0); }); }
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
start().catch(error => { console.error('Startup failed:', error.code || error.message); db.pool.end().finally(() => { process.exitCode = 1; }); });
