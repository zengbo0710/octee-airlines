CREATE TABLE auth_attempts (
  attempt_key TEXT PRIMARY KEY,
  username_normalized TEXT NOT NULL,
  failed_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  locked_until TEXT
);
CREATE INDEX auth_attempts_window_idx ON auth_attempts(window_started_at);
