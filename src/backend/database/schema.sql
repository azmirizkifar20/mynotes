CREATE SCHEMA IF NOT EXISTS mdpreview;
CREATE TABLE IF NOT EXISTS mdpreview.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS mdpreview.entries (
  id uuid PRIMARY KEY,
  path text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('folder','doc','asset')),
  content bytea,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private')),
  share_id text UNIQUE,
  revision integer NOT NULL DEFAULT 1,
  modified timestamptz NOT NULL DEFAULT now(),
  favorite boolean NOT NULL DEFAULT false,
  opened_at timestamptz,
  deleted_at timestamptz,
  trash_id uuid,
  search_vector tsvector NOT NULL DEFAULT ''::tsvector
);
CREATE UNIQUE INDEX IF NOT EXISTS entries_active_path ON mdpreview.entries (lower(path)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS entries_search ON mdpreview.entries USING gin(search_vector);
CREATE TABLE IF NOT EXISTS mdpreview.versions (
  entry_id uuid NOT NULL REFERENCES mdpreview.entries(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  content bytea NOT NULL,
  saved_at timestamptz NOT NULL,
  PRIMARY KEY(entry_id, revision)
);
CREATE TABLE IF NOT EXISTS mdpreview.drafts (
  entry_id uuid PRIMARY KEY REFERENCES mdpreview.entries(id) ON DELETE CASCADE,
  content text NOT NULL,
  base_revision integer NOT NULL,
  token uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mdpreview.templates (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
  content text NOT NULL,
  modified timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mdpreview.audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL,
  detail text NOT NULL,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mdpreview.sessions (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expire ON mdpreview.sessions(expire);
