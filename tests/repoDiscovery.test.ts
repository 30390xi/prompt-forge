import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { discover } from '../src/main/git/repoDiscovery'

function initGitRepo(dir: string): void {
  const r = spawnSync('git', ['init'], { cwd: dir })
  expect(r.status).toBe(0)
}

describe('discover', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  function makeTree(): { parent: string; rootRepo: string; childRepo: string; deepRepo: string } {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-discover-'))
    tempDirs.push(parent)
    const rootRepo = parent
    initGitRepo(rootRepo)

    const childRepo = path.join(parent, 'child-a')
    fs.mkdirSync(childRepo)
    initGitRepo(childRepo)

    const nested = path.join(parent, 'nested')
    fs.mkdirSync(nested)
    const deepRepo = path.join(nested, 'deep-b')
    fs.mkdirSync(deepRepo)
    initGitRepo(deepRepo)

    return { parent, rootRepo, childRepo, deepRepo }
  }

  it('depth 0：父路径本身是仓库时只发现它', () => {
    const { parent, rootRepo } = makeTree()
    const list = discover(parent, 0)
    expect(list.map((r) => path.resolve(r.path))).toEqual([path.resolve(rootRepo)])
  })

  it('depth 0：父路径不是仓库时为空', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-discover-'))
    tempDirs.push(parent)
    fs.mkdirSync(path.join(parent, 'only-child'))
    expect(discover(parent, 0)).toEqual([])
  })

  it('depth 1：包含父仓库与直接子目录仓库，不含更深层', () => {
    const { parent, rootRepo, childRepo, deepRepo } = makeTree()
    const paths = discover(parent, 1).map((r) => path.resolve(r.path))
    expect(paths).toContain(path.resolve(rootRepo))
    expect(paths).toContain(path.resolve(childRepo))
    expect(paths).not.toContain(path.resolve(deepRepo))
  })

  it('depth 2：包含两层子目录中的仓库', () => {
    const { parent, rootRepo, childRepo, deepRepo } = makeTree()
    const paths = discover(parent, 2).map((r) => path.resolve(r.path))
    expect(paths).toContain(path.resolve(rootRepo))
    expect(paths).toContain(path.resolve(childRepo))
    expect(paths).toContain(path.resolve(deepRepo))
  })

  it('父路径非仓库时 depth 1 只扫直接子目录', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-discover-'))
    tempDirs.push(parent)
    const childRepo = path.join(parent, 'proj')
    fs.mkdirSync(childRepo)
    initGitRepo(childRepo)
    const nested = path.join(parent, 'wrap')
    fs.mkdirSync(nested)
    const deepRepo = path.join(nested, 'inner')
    fs.mkdirSync(deepRepo)
    initGitRepo(deepRepo)

    const d1 = discover(parent, 1).map((r) => path.resolve(r.path))
    expect(d1).toContain(path.resolve(childRepo))
    expect(d1).not.toContain(path.resolve(deepRepo))

    const d2 = discover(parent, 2).map((r) => path.resolve(r.path))
    expect(d2).toContain(path.resolve(deepRepo))
  })
})
