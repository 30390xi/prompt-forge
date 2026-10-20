import { describe, expect, it } from 'vitest'
import { parseGitLog, classifyType, humanizeSubject } from '@shared/gitLogParse'

describe('parseGitLog', () => {
  it('parses pretty format blocks with shortstat', () => {
    const raw = `@@@abc123def45678@@@feat: add login

 2 files changed, 10 insertions(+), 1 deletion(-)
@@@fedcba987654321@@@fix: handle timeout

 1 file changed, 3 insertions(+), 0 deletions(-)`
    const items = parseGitLog(raw)
    expect(items).toHaveLength(2)
    expect(items[0].shortHash).toBe('abc123d')
    expect(items[0].typeLabel).toBe('新功能')
    expect(items[0].insertions).toBe(10)
    expect(items[1].typeLabel).toBe('修复')
  })
})

describe('classifyType', () => {
  it('maps conventional prefixes', () => {
    expect(classifyType('feat: x')).toBe('新功能')
    expect(classifyType('docs: x')).toBe('文档')
  })
})

describe('humanizeSubject', () => {
  it('strips conventional prefix', () => {
    expect(humanizeSubject('feat(api): 用户登录')).toBe('用户登录')
  })
})
