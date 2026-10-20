import { describe, expect, it } from 'vitest'
import { formatDailyReport, displayAuthor } from '@shared/dailyReportFormatter'
import type { RepoDayData } from '@shared/gitTypes'

function emptyRepo(name: string): RepoDayData {
  return {
    repoPath: `/work/${name}`,
    repoName: name,
    author: 'Alice',
    commits: [],
    inProgress: { summary: '', fileCount: 0, insertions: 0, deletions: 0 },
    totalCommits: 0,
    totalFiles: 0,
    totalInsertions: 0,
    totalDeletions: 0
  }
}

describe('formatDailyReport', () => {
  it('uses fixed template sections and 待补充 for tomorrow', () => {
    const report = formatDailyReport('2026-10-20', '张三', [emptyRepo('demo')])
    expect(report).toContain('【日报】2026-10-20（星期二）')
    expect(report).toContain('作者：张三')
    expect(report).toContain('一、今日完成')
    expect(report).toContain('今日所选仓库无提交记录。')
    expect(report).toContain('五、明日计划')
    expect(report).toContain('（待补充）')
  })

  it('groups commits by repo when multiple repos', () => {
    const repo = emptyRepo('api')
    repo.commits = [
      {
        hash: 'abcd1234efgh',
        shortHash: 'abcd123',
        subject: '添加登录',
        typeLabel: '新功能',
        filesChanged: 2,
        insertions: 10,
        deletions: 1
      }
    ]
    repo.totalCommits = 1
    repo.totalFiles = 2
    repo.totalInsertions = 10
    repo.totalDeletions = 1
    const report = formatDailyReport('2026-10-20', 'Alice', [repo, emptyRepo('web')])
    expect(report).toContain('【api】')
    expect(report).toContain('[新功能]')
    expect(report).toContain('abcd123')
  })
})

describe('displayAuthor', () => {
  it('prefers override', () => {
    expect(displayAuthor([emptyRepo('a')], '覆盖')).toBe('覆盖')
  })
})
