import type Database from 'better-sqlite3'
import { decryptApiKey, encryptApiKey, maskApiKey } from '../util/secretStorage'

export interface LlmProviderConfig {
  baseUrl: string
  apiKey: string
  model: string
  timeoutSeconds: number
}

export interface ProviderView {
  id: number
  presetKey: string | null
  name: string
  baseUrl: string
  model: string
  active: boolean
  hasApiKey: boolean
  apiKeyMasked: string
}

function trimSlash(url: string): string {
  let u = url.trim()
  while (u.endsWith('/')) u = u.slice(0, -1)
  return u
}

function envApiKey(): string {
  return (process.env.LLM_API_KEY ?? '').trim()
}

export function resolveActiveConfig(database: Database.Database): LlmProviderConfig {
  const row = database
    .prepare(
      'SELECT base_url, model, api_key_enc FROM llm_providers WHERE active = 1 ORDER BY id LIMIT 1'
    )
    .get() as { base_url: string; model: string; api_key_enc: string } | undefined

  const timeoutSeconds = 120
  if (row) {
    let key = decryptApiKey(row.api_key_enc)
    if (!key) key = envApiKey()
    return {
      baseUrl: trimSlash(row.base_url),
      apiKey: key,
      model: row.model,
      timeoutSeconds
    }
  }

  return {
    baseUrl: 'https://api.x.ai/v1',
    apiKey: envApiKey(),
    model: 'grok-4.7',
    timeoutSeconds
  }
}

export function listProvidersMasked(database: Database.Database): ProviderView[] {
  const rows = database
    .prepare('SELECT * FROM llm_providers ORDER BY id ASC')
    .all() as Array<{
    id: number
    preset_key: string | null
    name: string
    base_url: string
    model: string
    api_key_enc: string
    active: number
  }>

  return rows.map((p) => {
    const plain = decryptApiKey(p.api_key_enc)
    return {
      id: p.id,
      presetKey: p.preset_key,
      name: p.name,
      baseUrl: p.base_url,
      model: p.model,
      active: p.active === 1,
      hasApiKey: plain !== '',
      apiKeyMasked: maskApiKey(plain)
    }
  })
}

export function saveProvider(
  database: Database.Database,
  id: number | null,
  name: string,
  baseUrl: string,
  model: string,
  apiKey: string | undefined
): number {
  if (!name.trim()) throw new Error('名称不能为空')
  if (!baseUrl.trim()) throw new Error('Base URL 不能为空')
  if (!model.trim()) throw new Error('模型不能为空')

  if (id == null) {
    const r = database
      .prepare(
        'INSERT INTO llm_providers (name, base_url, model, api_key_enc, active) VALUES (?, ?, ?, ?, 0)'
      )
      .run(name.trim(), baseUrl.trim(), model.trim(), apiKey ? encryptApiKey(apiKey.trim()) : '')
    return Number(r.lastInsertRowid)
  }

  const existing = database.prepare('SELECT api_key_enc FROM llm_providers WHERE id = ?').get(id) as
    | { api_key_enc: string }
    | undefined
  if (!existing) throw new Error('提供商不存在')

  let keyEnc = existing.api_key_enc
  if (apiKey != null && apiKey.trim() !== '') {
    keyEnc = encryptApiKey(apiKey.trim())
  }
  database
    .prepare('UPDATE llm_providers SET name = ?, base_url = ?, model = ?, api_key_enc = ? WHERE id = ?')
    .run(name.trim(), baseUrl.trim(), model.trim(), keyEnc, id)
  return id
}

export function deleteProvider(database: Database.Database, id: number): void {
  database.prepare('DELETE FROM llm_providers WHERE preset_key IS NULL AND id = ?').run(id)
  const active = database.prepare('SELECT id FROM llm_providers WHERE active = 1').get()
  if (!active) {
    const first = database.prepare('SELECT id FROM llm_providers ORDER BY id LIMIT 1').get() as
      | { id: number }
      | undefined
    if (first) activateProvider(database, first.id)
  }
}

export function activateProvider(database: Database.Database, id: number): void {
  database.prepare('UPDATE llm_providers SET active = 0').run()
  database.prepare('UPDATE llm_providers SET active = 1 WHERE id = ?').run(id)
}
