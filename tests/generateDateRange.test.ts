import { describe, expect, it } from 'vitest'
import {
  inclusiveDayCount,
  reportDateStorageKey,
  validateGenerateDateRange
} from '@shared/generateDateRange'

describe('validateGenerateDateRange', () => {
  it('allows up to 10 inclusive calendar days', () => {
    expect(validateGenerateDateRange('2026-10-01', '2026-10-10').ok).toBe(true)
    const over = validateGenerateDateRange('2026-10-01', '2026-10-11')
    expect(over.ok).toBe(false)
    if (!over.ok) expect(over.error).toContain('10')
  })

  it('rejects start after end', () => {
    const r = validateGenerateDateRange('2026-10-20', '2026-10-18')
    expect(r.ok).toBe(false)
  })
})

describe('inclusiveDayCount', () => {
  it('counts single day as 1', () => {
    expect(inclusiveDayCount('2026-10-20', '2026-10-20')).toBe(1)
  })
})

describe('reportDateStorageKey', () => {
  it('uses range separator for multi-day', () => {
    expect(reportDateStorageKey('2026-10-18', '2026-10-20')).toBe('2026-10-18~2026-10-20')
    expect(reportDateStorageKey('2026-10-20', '2026-10-20')).toBe('2026-10-20')
  })
})
