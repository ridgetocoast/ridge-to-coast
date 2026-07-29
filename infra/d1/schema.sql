-- Ridge to Coast — newsletter subscriber store (Cloudflare D1 / SQLite)
--
-- Applied to the local store by scripts/dev.sh, and to a remote database with:
--   npx wrangler d1 execute DB --env <env> --remote --file infra/d1/schema.sql
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS subscribers (
  id              TEXT PRIMARY KEY,            -- crypto.randomUUID()
  channel         TEXT NOT NULL DEFAULT 'email', -- 'email' today, 'sms' later
  address         TEXT NOT NULL,               -- lowercased email (E.164 for sms)
  status          TEXT NOT NULL,               -- pending | confirmed | unsubscribed | bounced
  zone            TEXT,                        -- USDA hardiness zone, e.g. '7b'
  confirm_token   TEXT UNIQUE,                 -- cleared once confirmed
  unsub_token     TEXT NOT NULL UNIQUE,        -- lives for the row's lifetime
  source          TEXT,                        -- which page drove the signup
  ip_hash         TEXT,                        -- SHA-256(ip + salt): consent evidence, not PII
  user_agent      TEXT,
  created_at      TEXT NOT NULL,               -- ISO 8601 UTC
  confirmed_at    TEXT,
  unsubscribed_at TEXT
);

-- One row per address per channel. The channel column is what lets SMS arrive
-- later without a migration.
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_channel_address
  ON subscribers (channel, address);

CREATE INDEX IF NOT EXISTS subscribers_status ON subscribers (status);

-- Per-IP signup throttling. Rows are disposable; prune anything older than a day.
CREATE TABLE IF NOT EXISTS signup_attempts (
  ip_hash   TEXT NOT NULL,
  hour_slot TEXT NOT NULL,   -- 'YYYY-MM-DDTHH'
  attempts  INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_hash, hour_slot)
);
