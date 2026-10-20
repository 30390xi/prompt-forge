import fs from 'fs'
import path from 'path'
import { isGitRepo, requireAbsoluteDirectory, repoName } from '../util/pathSafety'

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'target', '.idea', '.vscode'])

export interface RepoInfo {
  path: string
  name: string
}

export function discover(parentFolderRaw: string, scanDepth: number): RepoInfo[] {
  const parent = requireAbsoluteDirectory(parentFolderRaw)
  const depth = Math.min(Math.max(scanDepth, 0), 2)
  const found = new Set<string>()
  collectRepos(parent, parent, depth, found)
  const list: RepoInfo[] = []
  for (const repo of found) {
    list.push({ path: repo, name: repoName(repo) })
  }
  list.sort((a, b) => a.name.localeCompare(b.name))
  return list
}

function collectRepos(root: string, current: string, depthRemaining: number, out: Set<string>): void {
  if (isGitRepo(current) && path.resolve(current) !== path.resolve(root)) {
    out.add(path.resolve(current))
    return
  }
  if (depthRemaining < 0) return

  let entries: string[]
  try {
    entries = fs.readdirSync(current)
  } catch {
    return
  }
  entries.sort()
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue
    const child = path.join(current, name)
    try {
      if (!fs.statSync(child).isDirectory()) continue
      if (isGitRepo(child)) {
        out.add(path.resolve(child))
      } else if (depthRemaining > 0) {
        collectRepos(root, child, depthRemaining - 1, out)
      }
    } catch {
      /* ignore */
    }
  }
}
