import type { CommitItem } from './gitTypes'

const CONVENTIONAL =
  /^(?:(?:feat|fix|refactor|docs|test|chore)(?:\([^)]+\))?!?:\s*)?(.+)$/i
const SHORTSTAT =
  /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/

export function parseIntGroup(g: string | undefined): number {
  if (g == null || g === '') return 0
  const n = parseInt(g, 10)
  return Number.isNaN(n) ? 0 : n
}

export function classifyType(subject: string): string {
  const lower = subject.toLowerCase()
  if (lower.startsWith('feat')) return '新功能'
  if (lower.startsWith('fix')) return '修复'
  if (lower.startsWith('refactor')) return '重构'
  if (lower.startsWith('docs')) return '文档'
  if (lower.startsWith('test')) return '测试'
  if (lower.startsWith('chore')) return '杂项'
  if (lower.includes('revert')) return '修复'
  return '杂项'
}

export function humanizeSubject(subject: string): string {
  const m = CONVENTIONAL.exec(subject.trim())
  let core = m ? m[1].trim() : subject.trim()
  if (core.length > 40) core = core.substring(0, 37) + '…'
  return core === '' ? '代码更新' : core
}

/** 解析 git log --pretty=format:@@@%H@@@%s --shortstat 输出 */
export function parseGitLog(raw: string | null | undefined): CommitItem[] {
  const list: CommitItem[] = []
  if (raw == null || raw.trim() === '') return list

  const commitRe =
    /@@@([0-9a-f]{7,40})@@@([^\n]+)\n([\s\S]*?)(?=(?:\n)?@@@[0-9a-f]{7,40}@@@|$)/gi
  let match: RegExpExecArray | null
  while ((match = commitRe.exec(raw)) !== null) {
    const hash = match[1]
    const subject = match[2].trim()
    const rest = match[3]
    let files = 0
    let ins = 0
    let del = 0
    const m = SHORTSTAT.exec(rest)
    if (m) {
      files = parseIntGroup(m[1])
      ins = parseIntGroup(m[2])
      del = parseIntGroup(m[3])
    }
    const human = humanizeSubject(subject)
    const type = classifyType(subject)
    list.push({
      hash,
      shortHash: hash.length >= 7 ? hash.substring(0, 7) : hash,
      subject: human,
      typeLabel: type,
      filesChanged: files,
      insertions: ins,
      deletions: del
    })
  }
  return list
}

export function parseShortstat(stat: string): { insertions: number; deletions: number } {
  const m = SHORTSTAT.exec(stat)
  if (!m) return { insertions: 0, deletions: 0 }
  return { insertions: parseIntGroup(m[2]), deletions: parseIntGroup(m[3]) }
}

export function summarizeStatus(status: string): string {
  const first = status.split('\n').find((l) => l.trim() !== '')?.trim() ?? ''
  if (first.length > 40) return first.substring(0, 37) + '…'
  return first === '' ? '有未提交改动' : '工作区有未提交改动'
}
