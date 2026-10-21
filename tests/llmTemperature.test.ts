import { describe, expect, it } from 'vitest'
import { resolveChatTemperature } from '@shared/llmTemperature'

describe('resolveChatTemperature', () => {
  it('uses 1 for Kimi Coding endpoint and kimi-for-coding', () => {
    expect(resolveChatTemperature('https://api.kimi.com/coding/v1', 'kimi-for-coding')).toBe(1)
    expect(resolveChatTemperature('https://api.kimi.com/coding/v1', 'kimi-for-coding-highspeed')).toBe(1)
  })

  it('keeps 0.3 for DeepSeek and Grok', () => {
    expect(resolveChatTemperature('https://api.deepseek.com', 'deepseek-flash')).toBe(0.3)
    expect(resolveChatTemperature('https://api.x.ai/v1', 'grok-4.7')).toBe(0.3)
    expect(resolveChatTemperature('https://open.bigmodel.cn/api/coding/paas/v4', 'glm-5.3')).toBe(0.3)
  })
})
