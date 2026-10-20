import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const DEFAULT_TIMEOUT_MS = 60_000

export class GitNotFoundError extends Error {
  constructor() {
    super('未找到 git 可执行文件。请安装 Git 并确保 git 在 PATH 中（Windows 可安装 Git for Windows）。')
    this.name = 'GitNotFoundError'
  }
}

function trimOutput(text: string): string {
  const t = text.trim()
  return t.length > 300 ? t.substring(0, 300) + '…' : t
}

export async function runGit(repo: string, args: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: repo,
      windowsHide: true,
      env: process.env
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('git 命令超时'))
    }, timeoutMs)

    child.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      if (err.code === 'ENOENT') {
        reject(new GitNotFoundError())
      } else {
        reject(err)
      }
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      const output = stdout + (stderr ? (stdout ? '\n' : '') + stderr : '')
      if (code !== 0) {
        reject(new Error(trimOutput(output)))
      } else {
        resolve(output.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd())
      }
    })
  })
}

export async function isGitAvailable(): Promise<boolean> {
  try {
    await runGit(process.cwd(), ['--version'], 5000)
    return true
  } catch (e) {
    if (e instanceof GitNotFoundError) return false
    return fs.existsSync(path.join(process.cwd(), '.git')) ? true : false
  }
}
