import { describe, expect, it } from 'vitest'
import {
  LLM_PRESET_CATALOG,
  getPresetByKey,
  shouldMigratePresetModel
} from '@shared/llmPresetCatalog'

describe('LLM_PRESET_CATALOG', () => {
  it('has verified coding-plan endpoints', () => {
    expect(getPresetByKey('glm')?.baseUrl).toBe('https://open.bigmodel.cn/api/coding/paas/v4')
    expect(getPresetByKey('glm')?.model).toBe('glm-5.3')
    expect(getPresetByKey('kimi')?.baseUrl).toBe('https://api.kimi.com/coding/v1')
    expect(getPresetByKey('kimi')?.model).toBe('kimi-for-coding')
    expect(getPresetByKey('deepseek')?.model).toBe('deepseek-flash')
  })

  it('catalog has four presets', () => {
    expect(LLM_PRESET_CATALOG.map((p) => p.presetKey).sort()).toEqual([
      'deepseek',
      'glm',
      'grok',
      'kimi'
    ])
  })
})

describe('shouldMigratePresetModel', () => {
  it('migrates retired deepseek-chat', () => {
    expect(shouldMigratePresetModel('deepseek', 'deepseek-chat', 'deepseek-flash')).toBe(true)
  })

  it('keeps user-chosen deepseek-v4-pro', () => {
    expect(shouldMigratePresetModel('deepseek', 'deepseek-v4-pro', 'deepseek-flash')).toBe(false)
  })

  it('migrates display labels with spaces', () => {
    expect(shouldMigratePresetModel('kimi', 'K2.7 Code HighSpeed', 'kimi-for-coding')).toBe(true)
  })

  it('migrates wrong casing glm id', () => {
    expect(shouldMigratePresetModel('glm', 'GLM-5.3', 'glm-5.3')).toBe(true)
  })
})
