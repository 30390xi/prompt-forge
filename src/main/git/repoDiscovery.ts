import fs from 'fs'
import path from 'path'
import { isGitRepo, requireAbsoluteDirectory, repoName } from '../util/pathSafety'

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'target', '.idea', '.vscode'])

export interface RepoInfo {
  path: string
  name: string
}

/**
 * 扫描父目录下的 Git 仓库。
 *
 * scanDepth 语义（与日报 UI 一致）：
 * - 0：仅当前目录——父路径本身是仓库则只返回它，否则为空（不扫子目录）
 * - 1：含直接子目录——父路径（若为仓库）+ 一层子文件夹中的仓库（不进入非仓库子目录再往下）
 * - 2：含两层子目录——父路径（若为仓库）+ 最多向非仓库子目录再向下探两层
 */
export function discover(parentFolderRaw: string, scanDepth: number): RepoInfo[] {
  const parent = requireAbsoluteDirectory(parentFolderRaw)
  const depth = Math.min(Math.max(scanDepth, 0), 2)
  const found = new Set<string>()

  if (isGitRepo(parent)) {
    found.add(path.resolve(parent))
  }

  if (depth >= 1) {
    const nestedDepth = depth - 1
    collectNestedRepos(parent, nestedDepth, found)
  }

  const list: RepoInfo[] = []
  for (const repo of found) {
    list.push({ path: repo, name: repoName(repo) })
  }
  list.sort((a, b) => a.name.localeCompare(b.name))
  return list
}

/** 在 parent 下查找嵌套仓库；nestedDepth 为可进入「非 Git 子目录」继续向下的层数 */
function collectNestedRepos(parent: string, nestedDepth: number, out: Set<string>): void {
  if (nestedDepth < 0) return

  let entries: string[]
  try {
    entries = fs.readdirSync(parent)
  } catch {
    return
  }
  entries.sort()
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue
    const child = path.join(parent, name)
    try {
      if (!fs.statSync(child).isDirectory()) continue
      if (isGitRepo(child)) {
        out.add(path.resolve(child))
      } else if (nestedDepth > 0) {
        collectNestedRepos(child, nestedDepth - 1, out)
      }
    } catch {
      /* ignore */
    }
  }
}
