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
├── AGENTS.md
├── package.json
├── server.js
├── views/
│   └── layout.ejs
├── public/
│   └── style.css
├── docs/
│   ├── README.md
│   └── steering/
│       ├── architecture.md
│       ├── system-flow.md
│       ├── tech-stack.md
│       └── routing.md
└── nginx/
    └── mdpreview.conf
```

## Conventions
- All document content is stored in PostgreSQL and mirrored under `docs/`; direct mirror edits are overwritten. Never import local files automatically or serve docs as static files.
- Directory browsing shows folders and `.md` files only.
- URL paths map to active database entries and their mirrored paths under `docs/`.
- `views/layout.ejs` is the shared shell for login gate, directory listing, markdown preview, and modals.
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
