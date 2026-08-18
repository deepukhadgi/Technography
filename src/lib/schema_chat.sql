-- Chat messages table for /chat interface
-- Run: node -e "require('./run_chat_migration.js')"

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created 
  ON chat_messages(user_id, created_at DESC);

-- Optional: add a cron to prune old messages (older than 30 days)
-- DELETE FROM chat_messages WHERE created_at < now() - interval '30 days';
