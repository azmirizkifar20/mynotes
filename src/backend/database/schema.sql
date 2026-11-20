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

CREATE TABLE IF NOT EXISTS mdpreview.passkeys (
  id text PRIMARY KEY,
  rp_id text NOT NULL,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  transports text[] NOT NULL DEFAULT '{}',
  device_type text NOT NULL,
  backed_up boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE TABLE IF NOT EXISTS mdpreview.auth_challenges (
  id uuid PRIMARY KEY,
  challenge text NOT NULL,
  purpose text NOT NULL CHECK(purpose IN ('registration','authentication')),
  session_hash text NOT NULL,
  app_url text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_challenges_expiry ON mdpreview.auth_challenges(expires_at);
CREATE TABLE IF NOT EXISTS mdpreview.auth_bridges (
  token_hash text PRIMARY KEY,
  session_hash text NOT NULL,
  app_url text NOT NULL,
  passkey_id text REFERENCES mdpreview.passkeys(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_bridges_expiry ON mdpreview.auth_bridges(expires_at);
ALTER TABLE mdpreview.auth_bridges ADD COLUMN IF NOT EXISTS completion_hash text;
