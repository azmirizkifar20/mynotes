CREATE SCHEMA IF NOT EXISTS mdpreview;
CREATE TABLE IF NOT EXISTS mdpreview.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS mdpreview.entries (
  id uuid PRIMARY KEY,
  path text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('folder','doc','asset','pdf','image')),
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
DO $$ BEGIN
  IF position('''image''' in pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conrelid='mdpreview.entries'::regclass AND conname='entries_kind_check'))) = 0 THEN
    ALTER TABLE mdpreview.entries DROP CONSTRAINT entries_kind_check;
    ALTER TABLE mdpreview.entries ADD CONSTRAINT entries_kind_check CHECK (kind IN ('folder','doc','asset','pdf','image'));
  END IF;
END $$;
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

CREATE TABLE IF NOT EXISTS mdpreview.task_board (
  id smallint PRIMARY KEY CHECK(id = 1),
  revision integer NOT NULL DEFAULT 1 CHECK(revision > 0)
);
CREATE TABLE IF NOT EXISTS mdpreview.task_statuses (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 32),
  tone text NOT NULL CHECK(tone IN ('neutral','blue','amber','green','red')),
  position integer NOT NULL CHECK(position >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS task_status_name ON mdpreview.task_statuses(lower(name));
CREATE TABLE IF NOT EXISTS mdpreview.tasks (
  id uuid PRIMARY KEY,
  number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK(length(description) <= 3000),
  status_id uuid NOT NULL REFERENCES mdpreview.task_statuses(id) ON DELETE RESTRICT,
  priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high')),
  due date,
  modified timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_status ON mdpreview.tasks(status_id);
ALTER TABLE mdpreview.task_statuses ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;
ALTER TABLE mdpreview.task_statuses ADD COLUMN IF NOT EXISTS in_progress boolean NOT NULL DEFAULT false;
ALTER TABLE mdpreview.tasks ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE mdpreview.tasks ADD COLUMN IF NOT EXISTS result text NOT NULL DEFAULT '' CHECK(length(result) <= 3000);
ALTER TABLE mdpreview.tasks ADD COLUMN IF NOT EXISTS start_date date CHECK(start_date IS NULL OR due IS NULL OR start_date <= due);
ALTER TABLE mdpreview.tasks ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(checklist)='array' AND jsonb_array_length(checklist) <= 100);
CREATE TABLE IF NOT EXISTS mdpreview.task_drafts (
  key text PRIMARY KEY CHECK(key='new' OR key ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'),
  body jsonb NOT NULL CHECK(jsonb_typeof(body)='object'),
  token uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mdpreview.task_tags (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 32)
);
CREATE UNIQUE INDEX IF NOT EXISTS task_tag_name ON mdpreview.task_tags(lower(name));
CREATE TABLE IF NOT EXISTS mdpreview.task_tag_links (
  task_id uuid NOT NULL REFERENCES mdpreview.tasks(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES mdpreview.task_tags(id) ON DELETE CASCADE,
  PRIMARY KEY(task_id, tag_id)
);
CREATE INDEX IF NOT EXISTS task_tag_links_tag ON mdpreview.task_tag_links(tag_id);
CREATE TABLE IF NOT EXISTS mdpreview.task_attachments (
  id uuid PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES mdpreview.tasks(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK(slot BETWEEN 1 AND 10),
  filename text NOT NULL CHECK(length(filename) BETWEEN 1 AND 200),
  content bytea NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 52428800),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, slot)
);
CREATE TABLE IF NOT EXISTS mdpreview.task_attachment_objects (
  object_key text PRIMARY KEY CHECK(object_key LIKE 'md-preview/task-attachments/%'),
  bucket text NOT NULL,
  delete_after timestamptz NOT NULL DEFAULT now() + interval '1 hour'
);
ALTER TABLE mdpreview.task_attachments ALTER COLUMN content DROP NOT NULL;
ALTER TABLE mdpreview.task_attachments ADD COLUMN IF NOT EXISTS object_key text REFERENCES mdpreview.task_attachment_objects(object_key) ON DELETE RESTRICT;
ALTER TABLE mdpreview.task_attachments ADD COLUMN IF NOT EXISTS size integer;
ALTER TABLE mdpreview.task_attachments DROP CONSTRAINT IF EXISTS task_attachments_size_check;
ALTER TABLE mdpreview.task_attachments ADD CONSTRAINT task_attachments_size_check CHECK(size BETWEEN 1 AND 104857600);
CREATE UNIQUE INDEX IF NOT EXISTS task_attachment_object ON mdpreview.task_attachments(object_key);
ALTER TABLE mdpreview.task_attachments DROP CONSTRAINT IF EXISTS task_attachment_storage;
ALTER TABLE mdpreview.task_attachments ADD CONSTRAINT task_attachment_storage CHECK(
  (content IS NOT NULL AND object_key IS NULL) OR (content IS NULL AND object_key IS NOT NULL AND size IS NOT NULL)
);
CREATE OR REPLACE FUNCTION mdpreview.queue_task_attachment_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.object_key IS NOT NULL THEN
    UPDATE mdpreview.task_attachment_objects SET delete_after=now() WHERE object_key=OLD.object_key;
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS task_attachment_delete ON mdpreview.task_attachments;
CREATE TRIGGER task_attachment_delete AFTER DELETE ON mdpreview.task_attachments
FOR EACH ROW EXECUTE FUNCTION mdpreview.queue_task_attachment_delete();

CREATE TABLE IF NOT EXISTS mdpreview.sticky_board (
  id smallint PRIMARY KEY CHECK(id = 1),
  revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
  notes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(notes) = 'array' AND jsonb_array_length(notes) <= 100),
  modified timestamptz NOT NULL DEFAULT now()
);
INSERT INTO mdpreview.sticky_board(id) VALUES(1) ON CONFLICT DO NOTHING;
