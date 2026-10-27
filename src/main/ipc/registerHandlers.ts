import { dialog, ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { DEFAULT_STYLE } from '@shared/promptEngine'
import { cleanupDailyReportRetention } from '../db/database'
import { detectGitContext } from '../git/gitDetect'
import { discover } from '../git/repoDiscovery'
import { GitNotFoundError } from '../git/gitRunner'
import {
  activateProvider,
  deleteProvider,
  listProvidersMasked,
  saveProvider
} from '../services/llmProviderService'
import {
  addCustomStyle,
  deleteCustomStyle,
  deleteHistory,
  enhance,
  historyPage,
  styleList
} from '../services/enhanceService'
import { generateDailyReport, polishDailyReport } from '../services/dailyReportService'
import { getWorkspaceSettings, updateWorkspace } from '../services/workspaceService'

const pendingEnhance = new Map<string, AbortController>()

export function registerIpcHandlers(database: Database.Database): void {
  cleanupDailyReportRetention(database)

  ipcMain.handle('styles:list', () => ({
    ok: true,
    styles: styleList(database),
    defaultStyle: DEFAULT_STYLE
  }))

  ipcMain.handle('styles:add', (_e, body: { id: string; name: string; guide: string }) => {
    const result = addCustomStyle(database, body.id, body.name, body.guide)
    return result
  })

  ipcMain.handle('styles:delete', (_e, id: number) => {
    deleteCustomStyle(database, id)
    return { ok: true }
  })

  ipcMain.handle('enhance', async (_e, body: { draft: string; style: string; requestId: string }) => {
    const ac = new AbortController()
    pendingEnhance.set(body.requestId, ac)
    try {
      const result = await enhance(database, body.draft, body.style, ac.signal)
      return result
    } finally {
      pendingEnhance.delete(body.requestId)
    }
  })

  ipcMain.on('enhance:abort', (_e, requestId: string) => {
    pendingEnhance.get(requestId)?.abort()
  })

  ipcMain.handle('history:list', (_e, page: number, size = 10) => {
    const data = historyPage(database, page, size)
    return { ok: true, ...data }
  })

  ipcMain.handle('history:delete', (_e, id: number) => {
    deleteHistory(database, id)
    return { ok: true }
  })

  ipcMain.handle('settings:workspace:get', () => ({
    ok: true,
    settings: getWorkspaceSettings(database)
  }))

  ipcMain.handle('settings:workspace:save', (_e, body: Record<string, unknown>) => {
    try {
      const settings = updateWorkspace(database, {
        parentFolder: body.parentFolder as string | undefined,
        scanDepth: body.scanDepth as number | undefined,
        timezone: body.timezone as string | undefined,
        authorOverride: body.authorOverride as string | undefined,
        reportRetentionDays: body.reportRetentionDays as number | undefined
      })
      cleanupDailyReportRetention(database)
      return { ok: true, settings }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('repos:scan', (_e, body: { parentFolder?: string; scanDepth?: number }) => {
    try {
      const ws = getWorkspaceSettings(database)
      const parent = body.parentFolder?.trim() || ws.parentFolder
      const depth = body.scanDepth ?? ws.scanDepth
      const repos = discover(parent, depth)
      return { ok: true, repos }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle(
    'git:detect-directory',
    async (_e, body: { directory?: string; scanDepth?: number }) => {
      const dir = body.directory?.trim()
      if (!dir) {
        return { ok: true, context: null }
      }
      try {
        const ws = getWorkspaceSettings(database)
        const depth = body.scanDepth ?? ws.scanDepth
        const context = await detectGitContext(dir, depth)
        return { ok: true, context }
      } catch (e) {
        if (e instanceof GitNotFoundError) {
          return { ok: false, error: e.message }
        }
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }
  )

  ipcMain.handle(
    'daily-report:generate',
    async (
      _e,
      body: {
        date?: string
        startDate?: string
        endDate?: string
        parentFolder?: string
        author?: string
        repos?: string[]
      }
    ) => {
      try {
        const start = body.startDate ?? body.date ?? null
        const end = body.endDate ?? body.date ?? null
        return await generateDailyReport(
          database,
          start,
          end,
          body.parentFolder ?? null,
          body.repos,
          body.author
        )
      } catch (e) {
        if (e instanceof GitNotFoundError) {
          return { ok: false, error: e.message }
        }
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }
  )

  ipcMain.handle('daily-report:polish', async (_e, body: { draft: string; style: string }) => {
    const result = await polishDailyReport(database, body.draft, body.style)
    if (result.ok) {
      return { ok: true, report: result.report, style: result.style }
    }
    return { ok: false, error: result.error, style: result.style }
  })

  ipcMain.handle('daily-report:records', () => {
    const rows = database
      .prepare(
        `SELECT id, report_date as reportDate, repos_json as reposJson, raw_text as rawText,
         polished_text as polishedText, created_at as createdAt
         FROM daily_report_records ORDER BY id DESC LIMIT 200`
      )
      .all()
      .map((r: Record<string, unknown>) => ({
        ...r,
        repos: JSON.parse(String(r.reposJson || '[]'))
      }))
    return { ok: true, records: rows }
  })

  ipcMain.handle('daily-report:records:delete', (_e, id: number) => {
    database.prepare('DELETE FROM daily_report_records WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('dialog:pickFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) {
      return { ok: false }
    }
    return { ok: true, path: result.filePaths[0] }
  })

  ipcMain.handle('dialog:saveText', async (_e, body: { defaultName: string; content: string }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: body.defaultName,
      filters: [{ name: 'Text', extensions: ['txt'] }]
    })
    if (result.canceled || !result.filePath) {
      return { ok: false }
    }
    const fs = await import('fs/promises')
    await fs.writeFile(result.filePath, body.content, 'utf8')
    return { ok: true, path: result.filePath }
  })

  ipcMain.handle('llm:providers:list', () => ({
    ok: true,
    providers: listProvidersMasked(database)
  }))

  ipcMain.handle(
    'llm:providers:save',
    (_e, body: { id?: number; name: string; baseUrl: string; model: string; apiKey?: string }) => {
      try {
        const id = saveProvider(database, body.id ?? null, body.name, body.baseUrl, body.model, body.apiKey)
        return { ok: true, id }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }
  )

  ipcMain.handle('llm:providers:delete', (_e, id: number) => {
    try {
      deleteProvider(database, id)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('llm:providers:activate', (_e, id: number) => {
    activateProvider(database, id)
    return { ok: true }
  })
}
