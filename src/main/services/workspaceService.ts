import type Database from 'better-sqlite3'
import { getWorkspace } from '../db/database'
import { requireAbsoluteDirectory } from '../util/pathSafety'

const SINGLETON_ID = 1

export function workspaceToMap(ws: ReturnType<typeof getWorkspace>) {
  return {
    parentFolder: ws.parent_folder ?? '',
    scanDepth: ws.scan_depth,
    timezone: ws.timezone,
    authorOverride: ws.author_override ?? '',
    reportRetentionDays: ws.report_retention_days
  }
}

export function getWorkspaceSettings(database: Database.Database) {
  return workspaceToMap(getWorkspace(database))
}

export function updateWorkspace(
  database: Database.Database,
  body: {
    parentFolder?: string
    scanDepth?: number
    timezone?: string
    authorOverride?: string
    reportRetentionDays?: number
  }
) {
  const current = getWorkspace(database)
  let parent = current.parent_folder
  if (body.parentFolder !== undefined) {
    const trimmed = body.parentFolder.trim()
    if (trimmed) {
      requireAbsoluteDirectory(trimmed)
      parent = trimmed
    } else {
      parent = null
    }
  }
  let scanDepth = current.scan_depth
  if (body.scanDepth != null) {
    scanDepth = Math.min(Math.max(body.scanDepth, 0), 2)
  }
  let timezone = current.timezone
  if (body.timezone?.trim()) {
    timezone = body.timezone.trim()
  }
  let authorOverride = current.author_override
  if (body.authorOverride !== undefined) {
    authorOverride = body.authorOverride.trim() ? body.authorOverride.trim() : null
  }
  let retention = current.report_retention_days
  if (body.reportRetentionDays != null) {
    retention = Math.min(Math.max(body.reportRetentionDays, 1), 3650)
  }

  database
    .prepare(
      `UPDATE workspace_settings SET parent_folder = ?, scan_depth = ?, timezone = ?, author_override = ?, report_retention_days = ? WHERE id = ?`
    )
    .run(parent, scanDepth, timezone, authorOverride, retention, SINGLETON_ID)

  return workspaceToMap(getWorkspace(database))
}
