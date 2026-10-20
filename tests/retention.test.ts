import { describe, expect, it } from 'vitest'
import { retentionCutoffIso, shouldKeepReportRecord } from '@shared/retention'

describe('retention', () => {
  const now = new Date('2026-10-20T12:00:00')

  it('default 10 days keeps records from Oct 11 onward', () => {
    const cutoff = retentionCutoffIso(10, now)
    expect(cutoff).toBe('2026-10-11')
    expect(shouldKeepReportRecord('2026-10-10', 10, now)).toBe(false)
    expect(shouldKeepReportRecord('2026-10-11', 10, now)).toBe(true)
    expect(shouldKeepReportRecord('2026-10-20', 10, now)).toBe(true)
  })

  it('respects configurable days', () => {
    expect(shouldKeepReportRecord('2026-10-17', 3, now)).toBe(false)
    expect(shouldKeepReportRecord('2026-10-18', 3, now)).toBe(true)
  })
})
