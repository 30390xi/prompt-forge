import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { LLM_PRESET_CATALOG, shouldMigratePresetModel } from '@shared/llmPresetCatalog'
import { retentionCutoffIso } from '@shared/retention'

const SINGLETON_SETTINGS_ID = 1
const DEFAULT_RETENTION_DAYS = 10

export interface WorkspaceRow {
  parent_folder: string | null
  scan_depth: number
  timezone: string
  author_override: string | null
  report_retention_days: number
}

let db: Database.Database | null = null

export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'prompt-forge.sqlite')
}

export function openDatabase(): Database.Database {
  if (db) return db
  db = new Database(getDbPath())
  db.pragma('journal_mode = WAL')
  migrate(db)
  seedPresets(db)
  ensurePresetCatalog(db)
  return db
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS workspace_settings (
      id INTEGER PRIMARY KEY,
      parent_folder TEXT,
      scan_depth INTEGER NOT NULL DEFAULT 1,
      timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
      author_override TEXT,
      report_retention_days INTEGER NOT NULL DEFAULT ${DEFAULT_RETENTION_DAYS}
    );

    CREATE TABLE IF NOT EXISTS custom_styles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      style_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      guide TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enhance_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draft TEXT NOT NULL,
      style TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS llm_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      preset_key TEXT UNIQUE,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      model TEXT NOT NULL,
      api_key_enc TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_report_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT NOT NULL,
      repos_json TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      polished_text TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `)

  const cols = database.prepare(`PRAGMA table_info(workspace_settings)`).all() as { name: string }[]
  if (!cols.some((c) => c.name === 'report_retention_days')) {
    database.exec(
      `ALTER TABLE workspace_settings ADD COLUMN report_retention_days INTEGER NOT NULL DEFAULT ${DEFAULT_RETENTION_DAYS}`
    )
  }

  database
    .prepare(
      `INSERT OR IGNORE INTO workspace_settings (id, scan_depth, timezone, report_retention_days) VALUES (?, 1, 'Asia/Shanghai', ?)`
    )
    .run(SINGLETON_SETTINGS_ID, DEFAULT_RETENTION_DAYS)
}

function seedPresets(database: Database.Database): void {
  const count = (database.prepare('SELECT COUNT(*) as c FROM llm_providers').get() as { c: number }).c
  if (count > 0) return

  const insert = database.prepare(
    `INSERT INTO llm_providers (preset_key, name, base_url, model, api_key_enc, active) VALUES (?, ?, ?, ?, '', ?)`
  )

  for (const preset of LLM_PRESET_CATALOG) {
    const active = preset.presetKey === 'grok' ? 1 : 0
    insert.run(preset.presetKey, preset.name, preset.baseUrl, preset.model, active)
  }
}

/**
 * 启动时同步预设目录：刷新 base_url / 显示名；在仍为旧默认或展示名时更新 model。
 * 不修改 api_key_enc、active（升级不强制改回 Grok）。
 */
export function ensurePresetCatalog(database: Database.Database): void {
  const insert = database.prepare(
    `INSERT INTO llm_providers (preset_key, name, base_url, model, api_key_enc, active)
     VALUES (?, ?, ?, ?, '', 0)`
  )
  const update = database.prepare(
    `UPDATE llm_providers SET name = ?, base_url = ?, model = ? WHERE preset_key = ?`
  )
  const updateMeta = database.prepare(
    `UPDATE llm_providers SET name = ?, base_url = ? WHERE preset_key = ?`
  )

  for (const preset of LLM_PRESET_CATALOG) {
    const row = database
      .prepare('SELECT preset_key, name, base_url, model FROM llm_providers WHERE preset_key = ?')
      .get(preset.presetKey) as
      | { preset_key: string; name: string; base_url: string; model: string }
      | undefined

    if (!row) {
      insert.run(preset.presetKey, preset.name, preset.baseUrl, preset.model)
      continue
    }

    const migrateModel = shouldMigratePresetModel(preset.presetKey, row.model, preset.model)
    if (migrateModel) {
      update.run(preset.name, preset.baseUrl, preset.model, preset.presetKey)
    } else {
      updateMeta.run(preset.name, preset.baseUrl, preset.presetKey)
    }
  }
}

export function getWorkspace(database: Database.Database): WorkspaceRow {
  return database
    .prepare(
      'SELECT parent_folder, scan_depth, timezone, author_override, report_retention_days FROM workspace_settings WHERE id = ?'
    )
    .get(SINGLETON_SETTINGS_ID) as WorkspaceRow
}

export function cleanupDailyReportRetention(database: Database.Database): number {
  const ws = getWorkspace(database)
  const cutoff = retentionCutoffIso(ws.report_retention_days)
  const result = database
    .prepare(
      `DELETE FROM daily_report_records WHERE
        CASE WHEN instr(report_date, '~') > 0
          THEN substr(report_date, 1, instr(report_date, '~') - 1)
          ELSE report_date END < ?`
    )
    .run(cutoff)
  return result.changes
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
