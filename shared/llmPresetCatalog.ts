/**
 * OpenAI 兼容 chat/completions 预设（桌面端 seed + 启动迁移）。
 * - DeepSeek：默认 deepseek-flash；可选 deepseek-v4-pro（deepseek-chat 已退役）
 * - GLM Coding Plan：须用 .../api/coding/paas/v4，模型 glm-5.3（小写 API id）
 * - Kimi Coding Plan：须用 api.kimi.com/coding/v1，模型 kimi-for-coding
 */

export interface LlmPresetDefinition {
  presetKey: string
  name: string
  baseUrl: string
  model: string
}

export const LLM_PRESET_CATALOG: readonly LlmPresetDefinition[] = [
  {
    presetKey: 'grok',
    name: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-4.7'
  },
  {
    presetKey: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-flash'
  },
  {
    presetKey: 'glm',
    name: 'GLM Coding Plan',
    baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
    model: 'glm-5.3'
  },
  {
    presetKey: 'kimi',
    name: 'Kimi Coding Plan',
    baseUrl: 'https://api.kimi.com/coding/v1',
    model: 'kimi-for-coding'
  }
]

export function getPresetByKey(key: string): LlmPresetDefinition | undefined {
  return LLM_PRESET_CATALOG.find((p) => p.presetKey === key)
}

/** 历史 seed / 文档中的旧默认模型 id（用户若已改为其他合法 id 则保留） */
export const LEGACY_PRESET_MODELS: Record<string, readonly string[]> = {
  grok: [],
  deepseek: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
  glm: ['glm-4-flash', 'glm-4', 'glm-4-plus', 'GLM-5.3', 'GLM-4-Flash', 'GLM-4-flash'],
  kimi: [
    'moonshot-v1-8k',
    'moonshot-v1-32k',
    'moonshot-v1-128k',
    'K2.7 Code HighSpeed',
    'k2.7 code highspeed',
    'k2-code-highspeed'
  ]
}

function normalizeModelId(model: string): string {
  return model.trim().toLowerCase()
}

/** 是否应将预设行的 model 更新为目录默认值（不触碰用户自定义的合法 id） */
export function shouldMigratePresetModel(
  presetKey: string,
  currentModel: string,
  catalogModel: string
): boolean {
  const m = currentModel.trim()
  if (m === '') return true
  if (m === catalogModel) return false
  if (/\s/.test(m)) return true
  const legacy = LEGACY_PRESET_MODELS[presetKey] ?? []
  if (legacy.some((old) => normalizeModelId(old) === normalizeModelId(m))) return true
  if (normalizeModelId(m) === normalizeModelId(catalogModel) && m !== catalogModel) return true
  return false
}
