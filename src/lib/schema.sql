-- Technography schema — comments, votes, users.
-- Idempotent: safe to run repeatedly.

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
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
  is_approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_post_slug_created_idx
  ON comments (post_slug, created_at DESC);

CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id int NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  voter_key text NOT NULL,
  value smallint NOT NULL CHECK (value IN (1, -1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, voter_key)
);
