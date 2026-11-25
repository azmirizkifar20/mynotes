# Ruangku: Vue and TypeScript migration

## Approved direction

Node.js / Express / TypeScript backend, Vue 3 / TypeScript / Vite frontend,
shadcn-vue / Tailwind components. Preserve the current visual design, behavior,
public document pages, passkeys, both URL mounts, PostgreSQL and R2.
No commit, push, deployment, remote restart or production data mutation.

## Execution

1. Record the current local UI using an isolated in-memory API fixture. Run
   existing checks and distinguish pre-existing failures from regressions.
2. Add separate backend/frontend TypeScript configurations, Vite production
   output and same-origin asset serving for both mounts. Preserve source-relative
   paths for env, schema, mirror and vendor assets. Add build/mount checks first.
3. Introduce Vue components and shadcn-vue primitives styled with existing CSS;
   disable Tailwind preflight to avoid changing the established design.
4. Migrate Task board rendering into typed Vue components, with domain contracts
   shared by the API and UI. Retain proven document editor, attachment, auth and
   mutation behavior through explicit transitional adapters rather than rewrite
   data-sensitive logic at the same time. Retire legacy renderers as their tests
   and remaining callers move to Vue; never use both renderers on the same host.
5. Convert backend composition/startup and the task-board API boundary to typed
   modules; retain JavaScript modules during gradual conversion. Keep runtime
   input validation, revision conflicts and security middleware unchanged.
6. Verify typechecks/build, focused component and integration tests, existing
   isolated checks, UI screenshots at desktop/mobile light/dark and mount paths.
   Exercise task CRUD, filters/views, archive, mentions, attachments and editor
   behavior only against the isolated local fixture.
7. Independent code review, fix important issues, write the local verification
   report and record the remaining migration stages explicitly.

## Scope and compatibility

This is the first runnable stage of the approved per-page migration, starting
with Task board. Existing document, sticky-note and management controllers remain
operational until their own Vue migrations; they must not be represented as fully
migrated. The migration introduces a frontend build step. PostgreSQL migrations,
real passkey registration and R2 uploads are not needed to verify this stage.

## Review focus

- No fixture route or authentication bypass in the application server.
- Vue-owned elements and legacy controller-owned elements have separate bounds;
  unmount before navigation, and prevent stale requests from rendering over pages.
- Preserve focus, keyboard access, reduced motion, native dialog lifecycle,
  unsaved drafts, upload guards and task revision checks.
- Resolve every lazy chunk, font and editor/passkey asset under root and /mynotes.
- Do not load shared .env or start mirror workers in fixture/integration tests.

## Progress

- Planning: complete. User approved the stack, folder structure and incremental
  sequence before authorizing implementation. Native execution; local-only rule
  overrides commit/deploy instructions in skills and project AGENTS.md.
- Foundation, typed backend composition/task HTTP, and Vue board rendering:
  complete for this first stage. Legacy controllers and other pages remain
  explicitly pending for the next per-page migrations.
- Local verification: build/typechecks, 8 new tests, 24 isolated existing checks,
  both-mount browser interactions and six baseline screenshot comparisons passed.
- Independent review complete; important findings addressed. See
  `2026-11-25-vue-typescript-local-verification.md` for scope and limitations.
