import path from 'path'
import { requireAbsoluteDirectory } from '../util/pathSafety'
import { runGit } from './gitRunner'
import { discover, type RepoInfo } from './repoDiscovery'

export interface GitDirectoryContext {
  directory: string
  inRepo: boolean
  repoRoot?: string
  branch?: string
  dirtySummary?: string
  /** 当所选目录不在 Git 仓库内时，按扫描深度发现的子仓库 */
  nestedRepos?: RepoInfo[]
}

/** 将 `git status --short` 输出压缩为简短中文说明（纯函数，便于单测） */
export function summarizeDirtyStatus(statusShort: string): string {
  const lines = statusShort
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)
  if (lines.length === 0) {
    return '工作区干净'
  }
  let staged = 0
  let unstaged = 0
  let untracked = 0
  for (const line of lines) {
    if (line.startsWith('??')) {
      untracked++
      continue
    }
    const x = line[0] ?? ' '
    const y = line[1] ?? ' '
    if (x !== ' ' && x !== '?') staged++
    if (y !== ' ' && y !== '?') unstaged++
  }
  const parts: string[] = []
  if (staged > 0) parts.push(`${staged} 项已暂存`)
  if (unstaged > 0) parts.push(`${unstaged} 项未暂存改动`)
  if (untracked > 0) parts.push(`${untracked} 个未跟踪文件`)
  return parts.length ? parts.join('，') : `${lines.length} 项改动`
}

export async function detectGitContext(
  directoryPathRaw: string,
  scanDepth = 1
): Promise<GitDirectoryContext> {
  const directory = requireAbsoluteDirectory(directoryPathRaw)
  const depth = Math.min(Math.max(scanDepth, 0), 2)

  let inRepo = false
  let repoRoot: string | undefined
  let branch: string | undefined
  let dirtySummary: string | undefined

  try {
    const top = await runGit(directory, ['rev-parse', '--show-toplevel'], 15_000)
    repoRoot = path.resolve(top.trim())
    inRepo = true
    const br = await runGit(directory, ['branch', '--show-current'], 10_000)
    branch = br.trim() || '（无当前分支）'
    try {
      const status = await runGit(directory, ['status', '--short'], 10_000)
      dirtySummary = summarizeDirtyStatus(status)
    } catch {
      dirtySummary = undefined
    }
  } catch {
    inRepo = false
    repoRoot = undefined
    branch = undefined
    dirtySummary = undefined
  }

  let nestedRepos: RepoInfo[] | undefined
  if (!inRepo) {
    try {
      nestedRepos = discover(directory, depth)
    } catch {
      nestedRepos = []
    }
  }

  return {
    directory,
    inRepo,
    repoRoot,
    branch,
    dirtySummary,
    nestedRepos
  }
}
