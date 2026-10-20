import type Database from 'better-sqlite3'
import {
  DEFAULT_STYLE,
  MAX_CUSTOM_STYLES,
  WB_SYSTEM,
  buildUserMessage,
  builtinStyles,
  cleanPrompt,
  isBuiltin,
  isValidStyleId,
  wrapCustomGuide,
  type StyleDef
} from '@shared/promptEngine'
import { chat } from './llmService'

export interface EnhanceResult {
  ok: boolean
  prompt?: string
  error?: string
  style: string
}

export function resolveStyles(database: Database.Database): Record<string, StyleDef> {
  const table: Record<string, StyleDef> = { ...builtinStyles() }
  const rows = database
    .prepare('SELECT style_key, name, guide FROM custom_styles ORDER BY id ASC')
    .all() as Array<{ style_key: string; name: string; guide: string }>

  let count = 0
  for (const custom of rows) {
    if (count >= MAX_CUSTOM_STYLES) break
    const key = custom.style_key
    if (!isValidStyleId(key) || isBuiltin(key)) continue
    const guide = (custom.guide ?? '').trim()
    if (!guide) continue
    table[key] = {
      id: key,
      name: custom.name,
      guide: wrapCustomGuide(key, guide),
      builtin: false
    }
    count++
  }
  return table
}

export async function enhance(
  database: Database.Database,
  draft: string,
  style: string,
  signal?: AbortSignal
): Promise<EnhanceResult> {
  if (!draft?.trim()) {
    return { ok: false, error: '草稿为空，没有可增强的内容', style }
  }
  const styles = resolveStyles(database)
  const normalized = styles[style] ? style : DEFAULT_STYLE
  const guide = styles[normalized].guide

  const llmResult = await chat(database, WB_SYSTEM, buildUserMessage(draft.trim(), guide || null), signal)
  if (!llmResult.ok) {
    return { ok: false, error: llmResult.error, style: normalized }
  }
  const prompt = cleanPrompt(llmResult.content)
  if (!prompt) {
    return { ok: false, error: '模型返回了空结果，请重试', style: normalized }
  }

  database
    .prepare('INSERT INTO enhance_history (draft, style, result) VALUES (?, ?, ?)')
    .run(draft.trim(), normalized, prompt)

  return { ok: true, prompt, style: normalized }
}

export function styleList(database: Database.Database): Array<Record<string, unknown>> {
  const styles = resolveStyles(database)
  const list: Array<Record<string, unknown>> = []
  for (const def of Object.values(styles)) {
    const item: Record<string, unknown> = {
      id: def.id,
      name: def.name,
      builtin: def.builtin
    }
    if (!def.builtin) {
      const row = database
        .prepare('SELECT id, guide FROM custom_styles WHERE style_key = ?')
        .get(def.id) as { id: number; guide: string } | undefined
      if (row) {
        item.dbId = row.id
        item.guide = row.guide
      }
    }
    list.push(item)
  }
  return list
}

export function addCustomStyle(
  database: Database.Database,
  styleKey: string,
  name: string,
  guide: string
): { ok: boolean; error?: string } {
  if (!isValidStyleId(styleKey)) {
    return { ok: false, error: '风格标识只能是小写字母开头的字母、数字、中划线、下划线，最长 32 位' }
  }
  if (isBuiltin(styleKey)) {
    return { ok: false, error: '不能覆盖内置风格' }
  }
  if (!guide?.trim()) {
    return { ok: false, error: '风格指令不能为空' }
  }
  if (guide.length > 1000) {
    return { ok: false, error: '风格指令不能超过 1000 字' }
  }
  const exists = database.prepare('SELECT id FROM custom_styles WHERE style_key = ?').get(styleKey)
  if (exists) {
    return { ok: false, error: '该风格标识已存在' }
  }
  const count = (database.prepare('SELECT COUNT(*) as c FROM custom_styles').get() as { c: number }).c
  if (count >= MAX_CUSTOM_STYLES) {
    return { ok: false, error: `自定义风格最多 ${MAX_CUSTOM_STYLES} 个` }
  }
  database
    .prepare('INSERT INTO custom_styles (style_key, name, guide) VALUES (?, ?, ?)')
    .run(styleKey, name?.trim() || styleKey, guide.trim())
  return { ok: true }
}

export function deleteCustomStyle(database: Database.Database, id: number): void {
  database.prepare('DELETE FROM custom_styles WHERE id = ?').run(id)
}

export function historyPage(database: Database.Database, page: number, size: number) {
  const safeSize = Math.min(Math.max(size, 1), 50)
  const safePage = Math.max(page, 0)
  const total = (database.prepare('SELECT COUNT(*) as c FROM enhance_history').get() as { c: number }).c
  const totalPages = Math.max(1, Math.ceil(total / safeSize))
  const rows = database
    .prepare(
      'SELECT id, draft, style, result, created_at as createdAt FROM enhance_history ORDER BY id DESC LIMIT ? OFFSET ?'
    )
    .all(safeSize, safePage * safeSize)
  return { content: rows, page: safePage, totalPages, totalElements: total }
}

export function deleteHistory(database: Database.Database, id: number): void {
  database.prepare('DELETE FROM enhance_history WHERE id = ?').run(id)
}
