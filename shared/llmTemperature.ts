/** Kimi Coding Plan 等模型仅允许 temperature = 1（见 API 错误说明） */
const TEMPERATURE_ONE_MODEL_PREFIXES = ['kimi-for-coding']

export function resolveChatTemperature(baseUrl: string, model: string): number {
  const m = model.trim().toLowerCase()
  const url = baseUrl.trim().toLowerCase()

  if (url.includes('api.kimi.com/coding')) {
    return 1
  }
  for (const prefix of TEMPERATURE_ONE_MODEL_PREFIXES) {
    if (m === prefix || m.startsWith(`${prefix}-`)) {
      return 1
    }
  }
  return 0.3
}
