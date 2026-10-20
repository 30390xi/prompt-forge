import fs from 'fs'
import path from 'path'

export function requireAbsoluteDirectory(raw: string): string {
  if (raw == null || raw.trim() === '') {
    throw new Error('路径不能为空')
  }
  const p = path.resolve(raw.trim())
  if (!path.isAbsolute(p)) {
    throw new Error('必须使用绝对路径')
  }
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
    throw new Error(`路径不存在或不是目录：${p}`)
  }
  return p
}

export function ensureUnderRoot(target: string, root: string): void {
  const normalizedTarget = path.resolve(target)
  const normalizedRoot = path.resolve(root)
  const rel = path.relative(normalizedRoot, normalizedTarget)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('路径不在允许的根目录下')
  }
}

export function isGitRepo(dir: string): boolean {
  try {
    return fs.statSync(path.join(dir, '.git')).isDirectory()
  } catch {
    return false
  }
}

export function repoName(repoRoot: string): string {
  return path.basename(repoRoot)
}
