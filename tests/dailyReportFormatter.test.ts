import { describe, expect, it } from 'vitest'
import { formatDailyReport, displayAuthor, mapWorkType } from '@shared/dailyReportFormatter'
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

describe('mapWorkType', () => {
  it('maps feat and fix conventions', () => {
    expect(mapWorkType('添加登录', '新功能')).toBe('开发')
    expect(mapWorkType('fix: null pointer', '修复')).toBe('bug修复')
    expect(mapWorkType('refactor auth', '重构')).toBe('体验优化')
  })
})

describe('formatDailyReport', () => {
  it('uses team header and per-repo grouping with parenthesis numbering', () => {
    const report = formatDailyReport('2026-10-20', '张三', [emptyRepo('demo')])
    expect(report).toContain('【日报】2026-10-20（星期二）')
    expect(report).toContain('作者：张三')
    expect(report).toContain('【demo】')
    expect(report).toContain('本仓库该日无提交记录')
    expect(report).not.toContain('一、今日完成')
  })

  it('formats commit lines with type and 开发完成 tag', () => {
    const repo = emptyRepo('prompt-forge')
    repo.commits = [
      {
        hash: 'abcd1234efgh',
        shortHash: 'abcd123',
        subject: '多项目日报按仓库聚合提交',
        typeLabel: '新功能',
        filesChanged: 2,
        insertions: 10,
        deletions: 1
      }
    ]
    repo.totalCommits = 1
    const report = formatDailyReport('2026-10-20', '张三', [repo])
    expect(report).toContain('【prompt-forge】')
    expect(report).toMatch(/1\) 【开发】 多项目日报按仓库聚合提交 【开发完成】/)
  })

  it('shows repo header even with a single repo and maps fix to bug修复', () => {
    const repo = emptyRepo('api')
    repo.commits = [
      {
        hash: 'abcd1234567890',
        shortHash: 'abcd123',
        subject: 'fix: temperature 校验',
        typeLabel: '修复',
        filesChanged: 1,
        insertions: 1,
        deletions: 0
      }
    ]
    const report = formatDailyReport('2026-10-20', 'Alice', [repo, emptyRepo('web')])
    expect(report).toContain('【api】')
    expect(report).toContain('【web】')
    expect(report).toMatch(/1\) 【bug修复】/)
  })

  it('adds WIP line with 未完成 under the repo', () => {
    const repo = emptyRepo('svc')
    repo.inProgress = { summary: '调整配置', fileCount: 2, insertions: 5, deletions: 1 }
    const report = formatDailyReport('2026-10-20', 'Bob', [repo])
    expect(report).toMatch(/1\) 【开发】 调整配置 【未完成】/)
  })
})

describe('displayAuthor', () => {
  it('prefers override', () => {
    expect(displayAuthor([emptyRepo('a')], '覆盖')).toBe('覆盖')
  })
})
