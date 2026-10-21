import type Database from 'better-sqlite3'
import { resolveChatTemperature } from '@shared/llmTemperature'
import { resolveActiveConfig } from './llmProviderService'

export interface LlmResult {
  ok: boolean
  content?: string
  error?: string
}

function brief(body: string | null): string {
  if (!body) return ''
  const text = body.replace(/\s+/g, ' ').trim()
  return text.length > 200 ? text.substring(0, 200) : text
}

function mapHttpError(status: number, body: string): string {
  switch (status) {
    case 400:
      return `请求参数错误：${brief(body)}`
    case 401:
    case 403:
      return '认证失败，请检查 API Key 是否正确'
    case 404:
      return '接口地址不存在，请检查 Base URL 配置'
    case 429:
      return '请求过于频繁或额度耗尽，稍后重试'
    default:
      return `模型调用失败，HTTP ${status}：${brief(body)}`
  }
}

export async function chat(
  database: Database.Database,
  system: string,
  user: string,
  signal?: AbortSignal
): Promise<LlmResult> {
  const config = resolveActiveConfig(database)
  if (!config.apiKey) {
    return {
      ok: false,
      error: '尚未配置模型 API Key，请在「设置(模型)」中添加或在环境变量 LLM_API_KEY 中设置'
    }
  }

  try {
    const resp = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        temperature: resolveChatTemperature(config.baseUrl, config.model),
        max_tokens: 4096,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      }),
      signal
    })

    const bodyText = await resp.text()
    if (!resp.ok) {
      return { ok: false, error: mapHttpError(resp.status, bodyText) }
    }

    const root = JSON.parse(bodyText) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = root.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      return { ok: false, error: '模型返回了空结果，请重试' }
    }
    return { ok: true, content }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, error: '请求已取消' }
    }
    if (e instanceof Error && e.message.includes('fetch failed')) {
      return { ok: false, error: `模型调用异常：${e.message}` }
    }
    return { ok: false, error: `模型调用异常：${String(e)}` }
  }
}
