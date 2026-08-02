import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

function resolveUrl() {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const dbPath = path.resolve(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "t5.sqlite"));
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return `file:${dbPath}`;
}

async function ensureColumn(
  client: ReturnType<typeof createClient>,
  table: string,
  column: string,
  definition: string,
) {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  const exists = result.rows.some((row) => String(row.name) === column);
  if (!exists) {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function main() {
  const url = resolveUrl();
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await client.executeMultiple(`
CREATE TABLE IF NOT EXISTS project_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_code TEXT NOT NULL DEFAULT 'T5-SUBSTRUCTURE',
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  password_hash TEXT,
  password_salt TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  credential_expires_at INTEGER,
  activated_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES project_users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_code TEXT NOT NULL DEFAULT 'T5-SUBSTRUCTURE',
  worker_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  trade TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  created_by_user_id INTEGER NOT NULL REFERENCES project_users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_code TEXT NOT NULL DEFAULT 'T5-SUBSTRUCTURE',
  worker_id TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  company TEXT NOT NULL,
  trade TEXT NOT NULL,
  action TEXT NOT NULL,
  remarks TEXT,
  photo_data TEXT,
  photo_url TEXT,
  latitude REAL,
  longitude REAL,
  accuracy_m REAL,
  location_verified INTEGER,
  location_label TEXT,
  distance_m REAL,
  recorded_by_user_id INTEGER NOT NULL REFERENCES project_users(id),
  recorded_at INTEGER NOT NULL
);
`);

  await ensureColumn(client, "attendance_records", "photo_data", "TEXT");
  await ensureColumn(client, "attendance_records", "photo_url", "TEXT");
  await ensureColumn(client, "attendance_records", "latitude", "REAL");
  await ensureColumn(client, "attendance_records", "longitude", "REAL");
  await ensureColumn(client, "attendance_records", "accuracy_m", "REAL");
  await ensureColumn(client, "attendance_records", "location_verified", "INTEGER");
  await ensureColumn(client, "attendance_records", "location_label", "TEXT");
  await ensureColumn(client, "attendance_records", "distance_m", "REAL");

  console.log(`Migrated database at ${url}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
