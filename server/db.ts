import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export const dbPath = process.env.DB_PATH ?? './data/sprint-planner.db';
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath, { create: true });

export function closeDb(): void { db.close(); }

db.exec('PRAGMA journal_mode=WAL');
db.exec('PRAGMA foreign_keys=ON');

db.exec(`
CREATE TABLE IF NOT EXISTS sprints (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'Planned',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS developers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS holidays (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,
  jira_key      TEXT,
  summary       TEXT NOT NULL DEFAULT '',
  type          TEXT NOT NULL DEFAULT 'Task',
  priority      TEXT NOT NULL DEFAULT 'Medium',
  status        TEXT NOT NULL DEFAULT 'To Do',
  assignee      TEXT,
  sprint_id     TEXT REFERENCES sprints(id) ON DELETE SET NULL,
  developer_id  INTEGER REFERENCES developers(id) ON DELETE SET NULL,
  effort_days   REAL NOT NULL DEFAULT 1,
  dev_eta       TEXT,
  effort_l0_num REAL,
  effort_l0_txt TEXT,
  effort_l1_num REAL,
  effort_l1_txt TEXT,
  notes         TEXT,
  last_synced   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS field_map (
  label_type  TEXT PRIMARY KEY,
  field_id    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`);
