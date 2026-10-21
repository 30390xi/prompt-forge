import type Database from 'better-sqlite3'
import {
  DAILY_REPORT_SYSTEM,
  DEFAULT_STYLE,
  buildDailyReportPolishMessage,
  cleanPrompt
} from '@shared/promptEngine'
import { displayAuthor, formatDailyReport } from '@shared/dailyReportFormatter'
import { reportDateStorageKey, validateGenerateDateRange } from '@shared/generateDateRange'
import { discover } from '../git/repoDiscovery'
import { assertGitRepo, collectRepo } from '../git/gitCollect'
import { requireAbsoluteDirectory, ensureUnderRoot, isGitRepo } from '../util/pathSafety'
import { cleanupDailyReportRetention, getWorkspace } from '../db/database'
import { resolveStyles, type EnhanceResult } from './enhanceService'
import { chat } from './llmService'

export async function generateDailyReport(
  database: Database.Database,
  startDate: string | null,
  endDate: string | null,
  parentFolder: string | null,
  repoPaths: string[] | null | undefined,
  authorOverride: string | null | undefined
): Promise<{ ok: boolean; report?: string; error?: string; repos?: string[] }> {
  try {
    const ws = getWorkspace(database)
    const zone = ws.timezone || 'Asia/Shanghai'
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date())
    const range = validateGenerateDateRange(
      startDate?.trim() || today,
      (endDate?.trim() || startDate?.trim() || today)
    )
    if (!range.ok) {
      return { ok: false, error: range.error }
    }
    const { start, end } = range

    let root: string
    if (parentFolder?.trim()) {
      root = requireAbsoluteDirectory(parentFolder)
    } else if (ws.parent_folder) {
      root = requireAbsoluteDirectory(ws.parent_folder)
    } else {
      throw new Error('请先选择父目录并保存，或填写有效的绝对路径')
    }

    const author =
      authorOverride?.trim() ||
      (ws.author_override?.trim() ? ws.author_override : null)

    let repos: string[]
    if (repoPaths && repoPaths.length > 0) {
      repos = []
      for (const raw of repoPaths) {
        const p = requireAbsoluteDirectory(raw)
        ensureUnderRoot(p, root)
        if (!isGitRepo(p)) throw new Error(`不是 Git 仓库：${p}`)
        repos.push(p)
      }
    } else {
      repos = discover(root, ws.scan_depth).map((r) => r.path)
      if (repos.length === 0) {
        throw new Error('未发现 Git 仓库，请检查父目录与扫描深度，或先点击「发现仓库」')
      }
    }

    const data = []
    for (const repo of repos) {
      assertGitRepo(repo)
      data.push(await collectRepo(repo, root, author, start, zone, end))
    }

    const authorDisplay = displayAuthor(data, author)
    const report = formatDailyReport(start, authorDisplay, data, end)

    const reposJson = JSON.stringify(repos)
    const reportDateKey = reportDateStorageKey(start, end)
    database
      .prepare(
        'INSERT INTO daily_report_records (report_date, repos_json, raw_text, polished_text) VALUES (?, ?, ?, NULL)'
      )
      .run(reportDateKey, reposJson, report)
    cleanupDailyReportRetention(database)

    return { ok: true, report, repos }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function polishDailyReport(
  database: Database.Database,
  draft: string,
  style: string,
  signal?: AbortSignal
): Promise<EnhanceResult & { report?: string }> {
  if (!draft?.trim()) {
    return { ok: false, error: '日报内容为空', style }
  }
  const styles = resolveStyles(database)
  const normalized = styles[style] ? style : DEFAULT_STYLE
  const guide = styles[normalized].guide

  const llmResult = await chat(
    database,
    DAILY_REPORT_SYSTEM,
    buildDailyReportPolishMessage(draft.trim(), guide || null),
    signal
  )
  if (!llmResult.ok) {
    return { ok: false, error: llmResult.error, style: normalized }
  }
  const out = cleanPrompt(llmResult.content)
  if (!out) {
    return { ok: false, error: '模型返回了空结果', style: normalized }
  }

  database
    .prepare(
      `UPDATE daily_report_records SET polished_text = ? WHERE id = (
        SELECT id FROM daily_report_records ORDER BY id DESC LIMIT 1
      )`
    )
    .run(out)

  return { ok: true, prompt: out, report: out, style: normalized }
}
