-- Initial schema, translated from the original SQLite definitions.
-- Column types and names are kept identical so application code and the
-- JSON it returns are unchanged. `active` stays INTEGER (0/1) on purpose.

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT UNIQUE NOT NULL,
  password       TEXT NOT NULL,
  name           TEXT NOT NULL DEFAULT '',
  role           TEXT NOT NULL DEFAULT 'user',
  active         INTEGER NOT NULL DEFAULT 1,
  login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until   TEXT,
  created        TEXT NOT NULL,
  last_login     TEXT
);

CREATE TABLE IF NOT EXISTS security_log (
  id      SERIAL PRIMARY KEY,
  ts      TEXT NOT NULL,
  event   TEXT NOT NULL,
  email   TEXT,
  ip      TEXT,
  details TEXT
);

CREATE TABLE IF NOT EXISTS password_resets (
  token   TEXT PRIMARY KEY,
  email   TEXT NOT NULL,
  expires TEXT NOT NULL,
  used    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cv (
  id        TEXT PRIMARY KEY,
  imie      TEXT NOT NULL DEFAULT '',
  nazwisko  TEXT NOT NULL DEFAULT '',
  badge     TEXT NOT NULL DEFAULT '',
  step      INTEGER NOT NULL DEFAULT 0,
  is_draft  INTEGER NOT NULL DEFAULT 0,
  photo_ext TEXT NOT NULL DEFAULT '',
  updated   TEXT NOT NULL,
  created   TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_seclog_ts    ON security_log(ts);
CREATE INDEX IF NOT EXISTS idx_seclog_email ON security_log(email);
CREATE INDEX IF NOT EXISTS idx_imie         ON cv(imie);
CREATE INDEX IF NOT EXISTS idx_nazwisko     ON cv(nazwisko);
CREATE INDEX IF NOT EXISTS idx_updated      ON cv(updated);
CREATE INDEX IF NOT EXISTS idx_draft        ON cv(is_draft);
