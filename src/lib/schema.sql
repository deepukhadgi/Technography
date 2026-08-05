-- Technography schema — comments, votes, users.
-- Idempotent: safe to run repeatedly.

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  verification_token text,
  verification_token_expires timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id serial PRIMARY KEY,
  post_slug text NOT NULL,
  user_id int REFERENCES users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  body text NOT NULL,
  parent_id int REFERENCES comments(id) ON DELETE CASCADE,
  notify_email text,
  is_approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id int REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS notify_email text;

CREATE INDEX IF NOT EXISTS comments_post_slug_created_idx
  ON comments (post_slug, created_at DESC);

CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id int NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  voter_key text NOT NULL,
  value smallint NOT NULL CHECK (value IN (1, -1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, voter_key)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id serial PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
  ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx
  ON password_reset_tokens (expires_at) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
