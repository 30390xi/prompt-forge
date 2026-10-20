import type { RepoDayData } from './gitTypes'

const WEEKDAY_ZH = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']

function inferRisks(repos: RepoDayData[]): string[] {
  const risks: string[] = []
  for (const repo of repos) {
    for (const c of repo.commits) {
      const lower = c.subject.toLowerCase()
      if (lower.includes('revert') || lower.includes('hotfix') || lower.startsWith('fix')) {
        let line = `[${repo.repoName}] ${c.subject}`
        if (line.length > 48) line = line.substring(0, 45) + '…'
        risks.push(line)
      }
    }
  }
  return risks
}

export function displayAuthor(repos: RepoDayData[], override: string | null | undefined): string {
  if (override != null && override.trim() !== '') return override.trim()
  const found = repos.map((r) => r.author).find((a) => a != null && a.trim() !== '')
  return found ?? '未知'
}

/** date: YYYY-MM-DD */
export function formatDailyReport(
  dateIso: string,
  authorDisplay: string,
  repos: RepoDayData[]
): string {
  const [y, m, d] = dateIso.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  const jsDay = utc.getUTCDay()
  const weekday = WEEKDAY_ZH[jsDay === 0 ? 6 : jsDay - 1]

  const sb: string[] = []
  sb.push(`【日报】${dateIso}（${weekday}）  作者：${authorDisplay}\n`)
  sb.push('一、今日完成')

  let anyCommit = false
  let itemIndex = 1
  for (const repo of repos) {
    if (repo.commits.length === 0) continue
    anyCommit = true
    if (repos.length > 1) {
      sb.push(`【${repo.repoName}】`)
    }
    for (const c of repo.commits) {
      sb.push(`${itemIndex++}. [${c.typeLabel}] ${c.subject}  ——  ${c.shortHash}`)
    }
  }
  if (!anyCommit) {
    sb.push('今日所选仓库无提交记录。')
  }

  sb.push('\n二、进行中')
  let anyWip = false
  let wipIndex = 1
  for (const repo of repos) {
    if (repo.inProgress.fileCount <= 0) continue
    anyWip = true
    const prefix = repos.length > 1 ? `（${repo.repoName}）` : ''
    const summary =
      repo.inProgress.summary.trim() === '' ? '未提交改动' : repo.inProgress.summary
    sb.push(
      `${wipIndex++}. ${prefix}${summary}（未提交改动：${repo.inProgress.fileCount} 个文件，+${repo.inProgress.insertions}/-${repo.inProgress.deletions}）`
    )
  }
  if (!anyWip) {
    sb.push('无')
  }

  let commits = 0
  let files = 0
  let ins = 0
  let del = 0
  for (const repo of repos) {
    commits += repo.totalCommits
    files += repo.totalFiles
    ins += repo.totalInsertions
    del += repo.totalDeletions
  }
  sb.push('\n三、代码统计')
  sb.push(`提交 ${commits} 次｜修改文件 ${files} 个｜新增 +${ins} 行｜删除 -${del} 行`)

  sb.push('\n四、问题与风险')
  const risks = inferRisks(repos)
  if (risks.length === 0) {
    sb.push('无')
  } else {
    risks.forEach((r, i) => sb.push(`${i + 1}. ${r}`))
  }

  sb.push('\n五、明日计划')
  sb.push('（待补充）')

  return sb.join('\n').trim() + '\n'
}
