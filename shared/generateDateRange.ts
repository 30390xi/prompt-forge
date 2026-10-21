/** 单次「一键生成」允许的最大日历天数（含起止日），与日报记录保留天数无关。 */
export const MAX_GENERATE_RANGE_DAYS = 10

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** 起止日均为 YYYY-MM-DD，含首尾的天数 */
export function inclusiveDayCount(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso).getTime()
  const end = parseIsoDate(endIso).getTime()
  return Math.floor((end - start) / 86_400_000) + 1
}

export function validateGenerateDateRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  maxDays = MAX_GENERATE_RANGE_DAYS
): { ok: true; start: string; end: string } | { ok: false; error: string } {
  const start = startIso?.trim() ?? ''
  const end = (endIso?.trim() || start).trim()
  if (!start) {
    return { ok: false, error: '请选择开始日期' }
  }
  if (!end) {
    return { ok: false, error: '请选择结束日期' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return { ok: false, error: '日期格式无效' }
  }
  if (start > end) {
    return { ok: false, error: '开始日期不能晚于结束日期' }
  }
  const days = inclusiveDayCount(start, end)
  if (days > maxDays) {
    return {
      ok: false,
      error: `日期跨度不能超过 ${maxDays} 天（含起止日，当前为 ${days} 天），请缩小范围后再生成`
    }
  }
  return { ok: true, start, end }
}

export function reportDateStorageKey(startIso: string, endIso: string): string {
  return startIso === endIso ? startIso : `${startIso}~${endIso}`
}
