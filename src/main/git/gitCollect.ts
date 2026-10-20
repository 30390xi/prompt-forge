import path from 'path'
import { parseGitLog, parseShortstat, summarizeStatus } from '@shared/gitLogParse'
import type { InProgress, RepoDayData } from '@shared/gitTypes'
import { ensureUnderRoot, isGitRepo, repoName } from '../util/pathSafety'
import { runGit } from './gitRunner'

function formatOffsetDateTime(date: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  const y = get('year')
  const m = get('month')
  const d = get('day')
  const h = get('hour')
  const min = get('minute')
  const s = get('second')

  const utcMs = Date.UTC(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(h),
    Number(min),
    Number(s)
  )
  const asUtc = new Date(utcMs)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    timeZoneName: 'longOffset'
  })
  const tzPart = formatter.formatToParts(asUtc).find((p) => p.type === 'timeZoneName')?.value ?? '+00:00'
  const offset = tzPart.replace('GMT', '').replace('UTC', '') || '+00:00'
  const off = offset === '' ? '+00:00' : offset
  return `${y}-${m}-${d}T${h}:${min}:${s}${off.length === 6 ? off : '+00:00'}`
}

function dayBoundsIso(dateIso: string, zone: string): { since: string; until: string } {
  const [y, m, d] = dateIso.split('-').map(Number)
  const startLocal = new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
  const endLocal = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0))
  return {
    since: formatOffsetDateTime(startLocal, zone),
    until: formatOffsetDateTime(endLocal, zone)
  }
}

async function readInProgress(repo: string): Promise<InProgress> {
  try {
    const status = await runGit(repo, ['status', '--short'])
    const lines = status.split('\n').filter((l) => l.trim() !== '')
    const fileCount = lines.length
    let ins = 0
    let del = 0
    if (fileCount > 0) {
      const stat = await runGit(repo, ['diff', '--stat'])
      const parsed = parseShortstat(stat)
      ins = parsed.insertions
      del = parsed.deletions
    }
    const summary = fileCount === 0 ? '' : summarizeStatus(status)
    return { summary, fileCount, insertions: ins, deletions: del }
  } catch {
    return { summary: '', fileCount: 0, insertions: 0, deletions: 0 }
  }
}

export async function collectRepo(
  repoPath: string,
  scanRoot: string,
  author: string | null | undefined,
  dateIso: string,
  zone: string
): Promise<RepoDayData> {
  ensureUnderRoot(repoPath, scanRoot)
  let resolvedAuthor = author?.trim() ?? ''
  if (resolvedAuthor === '') {
    try {
      resolvedAuthor = (await runGit(repoPath, ['config', 'user.name'])).trim()
    } catch {
      resolvedAuthor = '未知'
    }
  }

  const { since, until } = dayBoundsIso(dateIso, zone)
  let commits = []
  let totalFiles = 0
  let totalInsertions = 0
  let totalDeletions = 0

  try {
    const log = await runGit(repoPath, [
      'log',
      '--all',
      `--author=${resolvedAuthor}`,
      `--since=${since}`,
      `--until=${until}`,
      '--no-merges',
      '--pretty=format:@@@%H@@@%s',
      '--shortstat'
    ])
    commits = parseGitLog(log)
    for (const c of commits) {
      totalFiles += c.filesChanged
      totalInsertions += c.insertions
      totalDeletions += c.deletions
    }
  } catch {
    commits = []
  }

  const inProgress = await readInProgress(repoPath)
  return {
    repoPath: path.resolve(repoPath),
    repoName: repoName(repoPath),
    author: resolvedAuthor,
    commits,
    inProgress,
    totalCommits: commits.length,
    totalFiles,
    totalInsertions,
    totalDeletions
  }
}

export function assertGitRepo(dir: string): void {
  if (!isGitRepo(dir)) {
    throw new Error(`不是 Git 仓库：${dir}`)
  }
}
