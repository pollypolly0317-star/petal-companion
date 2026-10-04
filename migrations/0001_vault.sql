CREATE TABLE notes (
  path TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE revisions (
  path TEXT NOT NULL,
  revision INTEGER NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (path, revision)
);
CREATE INDEX revisions_path ON revisions(path);
