import { describe, expect, it } from 'vitest'
import { toIpcPlain } from '@shared/ipcPayload'

describe('toIpcPlain', () => {
  it('strips non-JSON values and produces cloneable data', () => {
    const input = {
      startDate: '2026-10-20',
      repos: ['/path/a', '/path/b'],
      nested: { n: 1 }
    }
    const out = toIpcPlain(input)
    expect(out).toEqual(input)
    expect(() => structuredClone(out)).not.toThrow()
  })
})
