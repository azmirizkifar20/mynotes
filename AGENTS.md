# AGENTS.md — MD Previewer

## Project Overview
MD Previewer is a Node.js + Express markdown browser/editor. PostgreSQL owns document bytes, access metadata, versions, drafts, preferences and sessions. `docs/` is a materialized mirror shared through the same DB by local and homeserver deployments. Read README.md for current setup and migration details.

## Steering Files
Read these before changing behavior or answering implementation questions:

- [architecture.md](docs/steering/architecture.md)
- [system-flow.md](docs/steering/system-flow.md)
- [tech-stack.md](docs/steering/tech-stack.md)
- [routing.md](docs/steering/routing.md)

## Current Structure
```
/var/www/html/md-previewer/
├── server.js                  # npm/PM2 entry
├── src/
│   ├── backend/
│   │   ├── app.js             # Express composition, no listener
│   │   ├── start.js           # DB/mirror readiness and listener
│   │   ├── config/
│   │   ├── database/          # connection, schema, initialization, audit
│   │   ├── middleware/
│   │   ├── modules/           # auth, documents, workspace, templates, activity
│   │   └── rendering/
│   └── frontend/
│       ├── views/             # layout + partials/dialogs
│       └── public/
│           ├── js/            # main.js, core, components, features
│           ├── css/           # main.css imports ordered stylesheets
│           ├── fonts/
│           └── favicon.svg
├── scripts/                   # operational DB/mirror commands
├── tests/                     # isolated checks, frontend module fixtures
├── mockups/
├── docs/                      # ignored DB mirror, only .gitkeep tracked
└── nginx/
```

## Conventions
- All document content is stored in PostgreSQL and mirrored under `docs/`; direct mirror edits are overwritten. Never import local files automatically or serve docs as static files.
- Directory browsing shows folders and `.md` files only.
- URL paths map to active database entries and their mirrored paths under `docs/`.
- `src/frontend/views/layout.ejs` composes the shared shell and partials for login, directory listing, markdown preview and dialogs.
- Backend uses CommonJS; frontend uses native ES Modules with explicit state/actions injection and delegated data attributes. No inline HTML event handlers or window application globals.
- Asset URLs use `/static/v/<hash>/` so relative JS/CSS imports share the deployment version on both mounts.
- `.env`, `docs/`, `uploads/` and `.data/` resolve from the project root via backend config/paths.js.
- CSS is custom, responsive, and lightweight.
- Dependencies stay minimal; there is no frontend build step.
- Server listens on port 8026 and is proxied by nginx.

## Commands
- `npm install` — install dependencies
- `npm start` — start the server
- `npm run dev` — start with nodemon for development
- `npm run db:setup` — check/create the configured PostgreSQL database
- `npm run docs:sync` — materialize the database into this instance's docs mirror

## Security
- Path traversal prevention: all paths must resolve within `docs/`.
- Do not serve hidden files (dotfiles).
- Sanitize rendered HTML output.
- Keep auth session-backed and rate-limited.
- Passkey login is centralized at itsazmi.com/mynotes (RP ID itsazmi.com); legacy/local apps use session-bound single-use bridges through the shared PostgreSQL DB. Only configured app URLs may exchange a handoff.
- Code access grants first-passkey registration only, never workspace access. Once a passkey exists, use passkeys or the expiring CLI recovery grant. Credential changes require recent verification; do not remove the last credential.

## Deployment
- Server dikelola dengan PM2, nama proses: `md-previewer`
- Setiap ada perubahan kode, WAJIB jalankan `pm2 restart md-previewer` sebelum melaporkan hasil ke user.
- Jangan minta user restart manual — harus terima beres.

## Memory Mechanism
- **File:** `memory.md` di root project.
- **Lifecycle:** On first use, create `memory.md` if it does not exist, then keep updating it in place.
- **Every Important Task:** After each meaningful task execution, append a summary line in this format: `[tanggal] — [task] — [keputusan] — [alasan]`.
- **End of Session:** At the end of every session, write a full summary section to `memory.md` covering what was done, important decisions, technical debt, and pending tasks.
- **Auto-Load:** At the start of every new session, read `memory.md` first so the agent retains prior context and decisions.
- **Close Session:** If the user types "Close Session", write the final summary to `memory.md` before ending the session.
- **Local Only:** `memory.md` is a local-user artifact and must remain ignored by git.
