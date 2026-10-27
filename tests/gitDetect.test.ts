import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { afterEach, describe, expect, it } from 'vitest'
import { detectGitContext, summarizeDirtyStatus } from '../src/main/git/gitDetect'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('summarizeDirtyStatus', () => {
  it('空输出表示工作区干净', () => {
    expect(summarizeDirtyStatus('')).toBe('工作区干净')
    expect(summarizeDirtyStatus('  \n  ')).toBe('工作区干净')
  })

  it('统计暂存、未暂存与未跟踪', () => {
    const sample = ['M  file.ts', ' M other.ts', '?? new.txt'].join('\n')
    expect(summarizeDirtyStatus(sample)).toBe('1 项已暂存，1 项未暂存改动，1 个未跟踪文件')
  })
})

describe('detectGitContext', () => {
  it('识别当前工程为 Git 仓库', async () => {
    const ctx = await detectGitContext(repoRoot, 0)
    expect(ctx.inRepo).toBe(true)
    expect(ctx.repoRoot).toBe(repoRoot)
    expect(ctx.branch).toBeTruthy()
    expect(ctx.nestedRepos).toBeUndefined()
  })

  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('非仓库父目录可发现直接子仓库', async () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-git-detect-'))
    tempDirs.push(parent)
    const childRepo = path.join(parent, 'child-repo')
    fs.mkdirSync(childRepo)
    const init = spawnSync('git', ['init'], { cwd: childRepo })
    expect(init.status).toBe(0)

    const ctx = await detectGitContext(parent, 1)
    expect(ctx.inRepo).toBe(false)
    const paths = (ctx.nestedRepos ?? []).map((r) => path.resolve(r.path))
    expect(paths).toContain(path.resolve(childRepo))
  })
})
