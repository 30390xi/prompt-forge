import type { CommitItem, RepoDayData } from './gitTypes'
import { inclusiveDayCount } from './generateDateRange'

const WEEKDAY_ZH = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']

function weekdayZh(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  const jsDay = utc.getUTCDay()
  return WEEKDAY_ZH[jsDay === 0 ? 6 : jsDay - 1]
}

function formatHeaderLine(startIso: string, endIso: string, authorDisplay: string): string {
  if (startIso === endIso) {
    return `【日报】${startIso}（${weekdayZh(startIso)}）  作者：${authorDisplay}`
  }
  const days = inclusiveDayCount(startIso, endIso)
  return `【日报】${startIso} 至 ${endIso}（共 ${days} 天）  作者：${authorDisplay}`
}

/** 团队日报「类型」枚举 */
export type WorkType =
  | '设计'
  | '需求'
  | '项目维护'
  | '开发'
  | 'bug修复'
  | '体验优化'
  | '测试'

/** 根据提交主题与归类标签映射工作类型 */
export function mapWorkType(subject: string, typeLabel: string): WorkType {
  const lower = subject.toLowerCase()
  const tl = typeLabel.trim()

  if (tl === '修复' || lower.startsWith('fix') || lower.includes('bug') || lower.includes('hotfix')) {
    return 'bug修复'
  }
  if (tl === '测试' || lower.startsWith('test')) {
    return '测试'
  }
  if (tl === '文档' || lower.startsWith('docs')) {
    return '项目维护'
  }
  if (lower.includes('design') || lower.includes('设计') || /\bui\b/.test(lower)) {
    return '设计'
  }
  if (lower.includes('需求') || lower.startsWith('req')) {
    return '需求'
  }
  if (
    lower.startsWith('chore') ||
    lower.includes('maintain') ||
    lower.includes('维护') ||
    tl === '杂项'
  ) {
    return '项目维护'
  }
  if (
    lower.startsWith('refactor') ||
    tl === '重构' ||
    lower.includes('ux') ||
    lower.includes('体验') ||
    lower.startsWith('style')
  ) {
    return '体验优化'
  }
  if (tl === '新功能' || lower.startsWith('feat')) {
    return '开发'
  }
  return '开发'
}

function formatWorkLine(index: number, workType: WorkType, task: string, statusTags: string[]): string {
  const tags = statusTags.map((t) => `【${t}】`).join('')
  const body = task.trim() || '代码更新'
  return `${index}) 【${workType}】 ${body}${tags ? ` ${tags}` : ''}`
}

function commitStatusTags(_commit: CommitItem): string[] {
  return ['开发完成']
}

function wipTaskContent(repo: RepoDayData): string {
  const summary = repo.inProgress.summary.trim()
  if (summary) return summary
  return `未提交改动（${repo.inProgress.fileCount} 个文件，+${repo.inProgress.insertions}/-${repo.inProgress.deletions}）`
}

export function displayAuthor(repos: RepoDayData[], override: string | null | undefined): string {
  if (override != null && override.trim() !== '') return override.trim()
  const found = repos.map((r) => r.author).find((a) => a != null && a.trim() !== '')
  return found ?? '未知'
}

/**
 * @param startDateIso YYYY-MM-DD
 * @param endDateIso 可选，默认同 start；跨多天时合并区间内提交
 */
export function formatDailyReport(
  startDateIso: string,
  authorDisplay: string,
  repos: RepoDayData[],
  endDateIso?: string
): string {
  const endIso = endDateIso ?? startDateIso
  const sb: string[] = []
  sb.push(`${formatHeaderLine(startDateIso, endIso, authorDisplay)}\n`)

  let anyContent = false

  for (const repo of repos) {
    sb.push(`\n【${repo.repoName}】`)
    let itemIndex = 1
    let repoHasLine = false

    for (const c of repo.commits) {
      const workType = mapWorkType(c.subject, c.typeLabel)
      sb.push(formatWorkLine(itemIndex++, workType, c.subject, commitStatusTags(c)))
      repoHasLine = true
      anyContent = true
    }

    if (repo.inProgress.fileCount > 0) {
      sb.push(
        formatWorkLine(itemIndex++, '开发', wipTaskContent(repo), ['未完成'])
      )
      repoHasLine = true
      anyContent = true
    }

    if (!repoHasLine) {
      sb.push(
        startDateIso === endIso
          ? '（本仓库该日无提交记录）'
          : '（本仓库该时段无提交记录）'
      )
    }
  }

  if (repos.length === 0) {
    sb.push(
      startDateIso === endIso
        ? '\n今日所选仓库无提交记录。'
        : '\n所选日期范围内无提交记录。'
    )
  } else if (!anyContent) {
    sb.push(
      startDateIso === endIso
        ? '\n今日所选仓库无提交记录。'
        : '\n所选日期范围内无提交记录。'
    )
  }

  return sb.join('\n').trim() + '\n'
}
