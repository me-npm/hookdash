import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SCHEMA_SQL, CURRENT_SCHEMA_VERSION } from './schema.js';
import type { HookdashConfig } from '../types/index.js';

let db: Database.Database | null = null;

/**
 * Get or create the SQLite database connection.
 * Applies WAL mode and creates schema if needed.
 */
export function getDatabase(config?: HookdashConfig): Database.Database {
  if (db) return db;

  const dbPath = config?.database.path
    ? resolve(config.database.path)
    : resolve('./hookdash.db');

  // Ensure directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  db = new Database(dbPath);

  // Performance pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('cache_size = -20000'); // 20MB

  // Apply schema
  applySchema(db);

  console.log(`[hookdash] Database ready at ${dbPath}`);
  return db;
}

/**
 * Apply schema and run migrations.
 */
function applySchema(database: Database.Database): void {
  database.exec(SCHEMA_SQL);

  // Check current version
  const row = database.prepare(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  ).get() as { version: number } | undefined;

  const currentVersion = row?.version ?? 0;

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    // Run migrations for each version
    runMigrations(database, currentVersion, CURRENT_SCHEMA_VERSION);

    // Update version
    database.prepare(
      'INSERT OR REPLACE INTO schema_version (version) VALUES (?)'
    ).run(CURRENT_SCHEMA_VERSION);
  }
}

/**
 * Run incremental migrations between versions.
 */
function runMigrations(
  database: Database.Database,
  _fromVersion: number,
  _toVersion: number
): void {
  // v1 is the initial schema — no migrations needed yet.
  // Future migrations go here:
  //
  // if (fromVersion < 2) {
  //   database.exec(`ALTER TABLE events ADD COLUMN size_bytes INTEGER`);
  // }
}

/**
 * Close the database connection.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Seed the database with sources and endpoints from config.
 */
export function seedFromConfig(config: HookdashConfig): void {
  const database = getDatabase(config);

  const upsertSource = database.prepare(`
    INSERT INTO sources (id, name, provider, signing_secret, active)
    VALUES (lower(hex(randomblob(8))), ?, ?, ?, 1)
    ON CONFLICT(name) DO UPDATE SET
      provider = excluded.provider,
      signing_secret = excluded.signing_secret,
      active = 1
  `);

  const getSource = database.prepare('SELECT id FROM sources WHERE name = ?');

  const upsertEndpoint = database.prepare(`
    INSERT INTO endpoints (id, url, source_id, event_filter, headers, timeout_ms, max_retries)
    VALUES (lower(hex(randomblob(8))), ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `);

  const checkEndpoint = database.prepare(
    'SELECT id FROM endpoints WHERE url = ? AND source_id = ?'
  );

  const seedTransaction = database.transaction(() => {
    for (const source of config.sources) {
      upsertSource.run(source.name, source.provider, source.signing_secret ?? null);
      const sourceRow = getSource.get(source.name) as { id: string };

      for (const endpoint of source.endpoints) {
        const existing = checkEndpoint.get(endpoint.url, sourceRow.id);
        if (!existing) {
          upsertEndpoint.run(
            endpoint.url,
            sourceRow.id,
            endpoint.events ? JSON.stringify(endpoint.events) : null,
            endpoint.headers ? JSON.stringify(endpoint.headers) : null,
            endpoint.timeout_ms ?? config.delivery.default_timeout,
            endpoint.max_retries ?? config.delivery.default_max_retries,
          );
        }
      }
    }
  });

  seedTransaction();
  console.log(`[hookdash] Seeded ${config.sources.length} source(s) from config`);
}
