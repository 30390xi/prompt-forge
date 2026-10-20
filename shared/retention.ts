/** 计算应保留记录的最早日期（含当天），早于该日期的记录应删除。 */
export function retentionCutoffIso(retentionDays: number, now = new Date()): string {
  const days = Math.max(1, Math.min(retentionDays, 3650))
  const cutoff = new Date(now)
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - (days - 1))
  const y = cutoff.getFullYear()
  const m = String(cutoff.getMonth() + 1).padStart(2, '0')
  const d = String(cutoff.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function shouldKeepReportRecord(
  reportDateIso: string,
  retentionDays: number,
  now = new Date()
): boolean {
  const cutoff = retentionCutoffIso(retentionDays, now)
  return reportDateIso >= cutoff
}
