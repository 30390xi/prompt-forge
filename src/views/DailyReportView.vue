<template>
  <div class="daily-root">
    <section class="card">
      <h2 class="card-title">多项目日报</h2>
      <p class="panel-desc">选择本地父目录后扫描 Git 仓库，按日期范围聚合提交与未提交改动，生成固定格式日报。</p>

      <div class="form-grid">
        <label class="field field-span2">
          <span>父目录（绝对路径）</span>
          <div class="path-row">
            <input
              v-model.trim="parentFolder"
              class="input input-grow"
              placeholder="/Users/you/work 或 C:\work"
              :disabled="actionBusy"
            />
            <button type="button" class="btn btn-ghost" :disabled="pickingFolder || actionBusy" @click="browseFolder">
              {{ pickingFolder ? '打开中…' : '选择文件夹' }}
            </button>
            <button type="button" class="btn btn-primary" :disabled="saving || actionBusy" @click="saveSettings">
              {{ saving ? '保存中…' : '保存' }}
            </button>
          </div>
          <div v-if="parentFolder" class="git-detect" aria-live="polite">
            <p v-if="gitDetecting" class="git-detect-line muted">正在识别当前目录下的 Git…</p>
            <template v-else-if="gitContext?.inRepo">
              <p class="git-detect-line">
                <span class="git-detect-label">已识别仓库</span>
                <span class="mono">{{ gitContext.branch }}</span>
                <span v-if="gitContext.dirtySummary" class="git-detect-dirty muted">· {{ gitContext.dirtySummary }}</span>
              </p>
              <p class="git-detect-line mono muted git-detect-root">{{ gitContext.repoRoot }}</p>
            </template>
            <template v-else>
              <p class="git-detect-line muted">当前目录不在 Git 仓库内。</p>
              <p v-if="nestedRepoHint" class="git-detect-line muted">{{ nestedRepoHint }}</p>
            </template>
          </div>
        </label>
        <label class="field">
          <span>开始日期</span>
          <input v-model="rangeStart" type="date" class="input" :disabled="actionBusy" @change="onRangeChange" />
        </label>
        <label class="field">
          <span>结束日期</span>
          <input v-model="rangeEnd" type="date" class="input" :disabled="actionBusy" @change="onRangeChange" />
        </label>
        <p class="field-span2 range-tip">
          单次生成最多连续 <span class="range-nowrap">{{ maxRangeDays }} 天</span>（含起止日）。当前跨度：<span class="range-nowrap">{{ rangeSpanLabel }}</span>
        </p>
        <label class="field">
          <span>作者覆盖（可选）</span>
          <input
            v-model.trim="authorOverride"
            class="input"
            placeholder="默认使用各仓库 git user.name"
            :disabled="actionBusy"
          />
        </label>
        <label class="field">
          <span>扫描深度</span>
          <select v-model.number="scanDepth" class="select" :disabled="actionBusy">
            <option :value="0">仅当前目录（本路径若为 Git 仓库）</option>
            <option :value="1">含直接子目录中的仓库</option>
            <option :value="2">含两层子目录中的仓库</option>
          </select>
        </label>
      </div>

      <div v-if="rangeError" class="error-box">{{ rangeError }}</div>

      <div class="repo-toolbar">
        <button type="button" class="btn btn-ghost" :disabled="scanning || actionBusy" @click="scanRepos">
          {{ scanning ? '扫描中…' : '发现仓库' }}
        </button>
        <button type="button" class="btn btn-primary" :disabled="generating || actionBusy || !!rangeError" @click="generate">
          {{ generating ? '生成中…' : '一键生成' }}
        </button>
      </div>
      <p v-if="formError" class="error-text">{{ formError }}</p>
      <p v-if="!repos.length && !formError && !scanning" class="panel-desc hint-line">
        未扫描仓库时也可直接生成：将自动在父目录下发现 Git 仓库（请先填写并保存父目录）。
      </p>

      <div v-if="repos.length" class="repo-list">
        <label v-for="r in repos" :key="r.path" class="repo-check">
          <input v-model="selectedRepos" type="checkbox" :value="r.path" :disabled="actionBusy" />
          <span>{{ r.name }}</span>
          <span class="mono muted">{{ r.path }}</span>
        </label>
      </div>
    </section>

    <section class="card report-card">
      <div class="card-head">
        <h2 class="card-title">日报草稿</h2>
        <div class="head-actions">
          <select v-model="polishStyle" class="select" :disabled="actionBusy">
            <option v-for="s in styles" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <button type="button" class="btn btn-ghost" :disabled="!report || polishing || actionBusy" @click="polish">
            {{ polishing ? '润色中…' : '用提示词增强润色' }}
          </button>
          <button type="button" class="btn btn-ghost" :disabled="!report || copying || actionBusy" @click="copyReport">
            {{ copying ? '复制中…' : copied ? '已复制' : '复制' }}
          </button>
          <button type="button" class="btn btn-ghost" :disabled="!report || exporting || actionBusy" @click="exportReport">
            {{ exporting ? '导出中…' : '导出 .txt' }}
          </button>
        </div>
      </div>
      <div v-if="polishError" class="error-box">{{ polishError }}</div>
      <textarea v-model="report" class="report-text" placeholder="点击「一键生成」后在此显示日报"></textarea>
    </section>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">日报记录</h2>
        <button type="button" class="btn btn-ghost" :disabled="loadingRecords || actionBusy" @click="loadRecords">
          {{ loadingRecords ? '刷新中…' : '刷新' }}
        </button>
      </div>
      <p class="panel-desc">自动保存每次生成的日报；默认保留最近 {{ retentionDays }} 天（可在设置中调整）。</p>
      <div v-if="records.length === 0" class="result-placeholder muted">
        <p>暂无记录</p>
      </div>
      <div v-else class="record-list">
        <div v-for="rec in records" :key="rec.id" class="record-item">
          <div class="record-head">
            <strong>{{ rec.reportDate }}</strong>
            <span class="mono muted">{{ formatTime(rec.createdAt) }}</span>
            <button type="button" class="btn btn-ghost" :disabled="actionBusy" @click="loadRecord(rec)">载入</button>
            <button type="button" class="btn btn-ghost" :disabled="copyingRecordId === rec.id" @click="copyRecord(rec)">
              {{ copyingRecordId === rec.id ? '复制中…' : '复制' }}
            </button>
            <button
              type="button"
              class="btn btn-danger-sm"
              :disabled="deletingRecordId === rec.id || actionBusy"
              @click="removeRecord(rec.id)"
            >
              {{ deletingRecordId === rec.id ? '删除中…' : '删除' }}
            </button>
          </div>
          <p class="mono muted record-repos">{{ (rec.repos || []).join(', ') }}</p>
          <pre class="record-preview">{{ previewText(rec) }}</pre>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  MAX_GENERATE_RANGE_DAYS,
  inclusiveDayCount,
  validateGenerateDateRange
} from '../../shared/generateDateRange'
import {
  fetchWorkspaceSettings,
  saveWorkspaceSettings,
  scanRepos as apiScan,
  detectGitDirectory,
  generateDailyReport,
  polishDailyReport,
  fetchStyles,
  pickFolder,
  saveTextFile,
  fetchDailyReportRecords,
  deleteDailyReportRecord
} from '../api.js'

const maxRangeDays = MAX_GENERATE_RANGE_DAYS
const parentFolder = ref('')
const rangeStart = ref(todayIso())
const rangeEnd = ref(todayIso())
const authorOverride = ref('')
const scanDepth = ref(1)
const retentionDays = ref(10)
const repos = ref([])
const selectedRepos = ref([])
const report = ref('')
const styles = ref([])
const polishStyle = ref('concise')
const records = ref([])

const scanning = ref(false)
const generating = ref(false)
const polishing = ref(false)
const saving = ref(false)
const pickingFolder = ref(false)
const loadingRecords = ref(false)
const exporting = ref(false)
const copying = ref(false)
const copyingRecordId = ref(null)
const deletingRecordId = ref(null)

const formError = ref('')
const polishError = ref('')
const rangeError = ref('')
const copied = ref(false)

const gitDetecting = ref(false)
const gitContext = ref(null)
let gitDetectTimer = null

const nestedRepoHint = computed(() => {
  const list = gitContext.value?.nestedRepos
  if (!list?.length) {
    return '可点击「发现仓库」扫描子目录，或直接一键生成（将自动发现）。'
  }
  const names = list.slice(0, 3).map((r) => r.name).join('、')
  const more = list.length > 3 ? ` 等 ${list.length} 个` : ''
  return `在其下发现 ${list.length} 个子仓库：${names}${more}。可点击「发现仓库」载入列表。`
})

const actionBusy = computed(
  () =>
    scanning.value ||
    generating.value ||
    polishing.value ||
    saving.value ||
    pickingFolder.value ||
    loadingRecords.value ||
    exporting.value ||
    copying.value ||
    deletingRecordId.value != null
)

const rangeSpanLabel = computed(() => {
  if (!rangeStart.value || !rangeEnd.value) return '—'
  if (rangeStart.value > rangeEnd.value) return '无效（开始晚于结束）'
  return `${inclusiveDayCount(rangeStart.value, rangeEnd.value)} 天`
})

function todayIso() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function onRangeChange() {
  rangeError.value = ''
  const v = validateGenerateDateRange(rangeStart.value, rangeEnd.value)
  if (!v.ok) rangeError.value = v.error
}

function validateBeforeGenerate() {
  formError.value = ''
  rangeError.value = ''
  if (!parentFolder.value.trim()) {
    formError.value = '请先选择或填写父目录，并建议点击「保存」'
    return false
  }
  const v = validateGenerateDateRange(rangeStart.value, rangeEnd.value)
  if (!v.ok) {
    rangeError.value = v.error
    formError.value = v.error
    return false
  }
  return true
}

async function refreshGitDetect() {
  const dir = parentFolder.value.trim()
  if (!dir) {
    gitContext.value = null
    return
  }
  gitDetecting.value = true
  try {
    const data = await detectGitDirectory({ directory: dir, scanDepth: scanDepth.value })
    if (data.ok) {
      gitContext.value = data.context
    } else {
      gitContext.value = null
    }
  } catch {
    gitContext.value = null
  } finally {
    gitDetecting.value = false
  }
}

function scheduleGitDetect() {
  if (gitDetectTimer) clearTimeout(gitDetectTimer)
  gitDetectTimer = setTimeout(() => {
    gitDetectTimer = null
    void refreshGitDetect()
  }, 400)
}

async function loadSettings() {
  try {
    const data = await fetchWorkspaceSettings()
    if (data.ok && data.settings) {
      parentFolder.value = data.settings.parentFolder || ''
      scanDepth.value = data.settings.scanDepth ?? 1
      authorOverride.value = data.settings.authorOverride || ''
      retentionDays.value = data.settings.reportRetentionDays ?? 10
      scheduleGitDetect()
    } else if (!data.ok) {
      formError.value = data.error || '加载工作区设置失败'
    }
  } catch (e) {
    formError.value = e?.message || '加载工作区设置失败'
  }
}

async function saveSettings() {
  formError.value = ''
  saving.value = true
  try {
    const data = await saveWorkspaceSettings({
      parentFolder: parentFolder.value,
      scanDepth: scanDepth.value,
      authorOverride: authorOverride.value
    })
    if (!data.ok) formError.value = data.error || '保存失败'
    else if (data.settings) retentionDays.value = data.settings.reportRetentionDays ?? 10
  } catch (e) {
    formError.value = e?.message || '保存失败'
  } finally {
    saving.value = false
  }
}

async function browseFolder() {
  pickingFolder.value = true
  formError.value = ''
  try {
    const data = await pickFolder()
    if (data.ok && data.path) {
      parentFolder.value = data.path
      scheduleGitDetect()
    } else if (!data.ok && data.error) {
      formError.value = data.error
    }
  } catch (e) {
    formError.value = e?.message || '打开文件夹选择器失败'
  } finally {
    pickingFolder.value = false
  }
}

async function scanRepos() {
  formError.value = ''
  if (!parentFolder.value.trim()) {
    formError.value = '请先选择或填写父目录'
    return
  }
  scanning.value = true
  try {
    const data = await apiScan({ parentFolder: parentFolder.value, scanDepth: scanDepth.value })
    if (data.ok) {
      repos.value = data.repos || []
      selectedRepos.value = repos.value.map(r => r.path)
      if (!repos.value.length) {
        formError.value =
          scanDepth.value === 0
            ? '当前目录不是 Git 仓库；可改用更深的扫描范围或选择仓库根路径'
            : '未发现 Git 仓库，请检查父目录或扫描深度'
      }
    } else {
      formError.value = data.error || '扫描失败'
    }
  } catch (e) {
    formError.value = e?.message || '扫描失败'
  } finally {
    scanning.value = false
  }
}

async function generate() {
  if (!validateBeforeGenerate()) return
  generating.value = true
  polishError.value = ''
  try {
    const reposArg =
      selectedRepos.value.length > 0 ? [...selectedRepos.value] : undefined
    const data = await generateDailyReport({
      startDate: rangeStart.value,
      endDate: rangeEnd.value,
      parentFolder: parentFolder.value,
      author: authorOverride.value || undefined,
      repos: reposArg
    })
    if (data.ok) {
      report.value = data.report
      await loadRecords()
    } else {
      formError.value = data.error || '生成失败'
    }
  } catch (e) {
    formError.value = e?.message || '生成时发生未知错误，请查看父目录、日期与 Git 环境'
  } finally {
    generating.value = false
  }
}

async function polish() {
  polishError.value = ''
  polishing.value = true
  try {
    const data = await polishDailyReport(report.value, polishStyle.value)
    if (data.ok) {
      report.value = data.report
      await loadRecords()
    } else if (data.error !== '请求已取消') {
      polishError.value = data.error || '润色失败'
    }
  } catch (e) {
    polishError.value = e?.message || '润色失败'
  } finally {
    polishing.value = false
  }
}

async function copyReport() {
  copying.value = true
  polishError.value = ''
  try {
    await navigator.clipboard.writeText(report.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    polishError.value = '复制失败'
  } finally {
    copying.value = false
  }
}

function exportFileName() {
  return rangeStart.value === rangeEnd.value
    ? `日报-${rangeStart.value}.txt`
    : `日报-${rangeStart.value}_${rangeEnd.value}.txt`
}

async function exportReport() {
  exporting.value = true
  polishError.value = ''
  try {
    const data = await saveTextFile(exportFileName(), report.value)
    if (!data.ok && !data.canceled) {
      polishError.value = data.error || '导出失败'
    }
    if (!data.ok) {
      const blob = new Blob([report.value], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportFileName()
      a.click()
      URL.revokeObjectURL(url)
    }
  } catch (e) {
    polishError.value = e?.message || '导出失败'
  } finally {
    exporting.value = false
  }
}

function previewText(rec) {
  const text = rec.polishedText || rec.rawText || ''
  return text.length > 280 ? text.slice(0, 280) + '…' : text
}

function applyRecordDates(reportDateKey) {
  if (!reportDateKey) return
  if (reportDateKey.includes('~')) {
    const [s, e] = reportDateKey.split('~')
    rangeStart.value = s
    rangeEnd.value = e
  } else {
    rangeStart.value = reportDateKey
    rangeEnd.value = reportDateKey
  }
  onRangeChange()
}

function loadRecord(rec) {
  report.value = rec.polishedText || rec.rawText
  applyRecordDates(rec.reportDate)
}

async function copyRecord(rec) {
  copyingRecordId.value = rec.id
  try {
    await navigator.clipboard.writeText(rec.polishedText || rec.rawText)
  } catch {
    formError.value = '复制失败'
  } finally {
    copyingRecordId.value = null
  }
}

async function loadRecords() {
  loadingRecords.value = true
  try {
    const data = await fetchDailyReportRecords()
    if (data.ok) records.value = data.records || []
    else formError.value = data.error || '加载日报记录失败'
  } catch (e) {
    formError.value = e?.message || '加载日报记录失败'
  } finally {
    loadingRecords.value = false
  }
}

async function removeRecord(id) {
  deletingRecordId.value = id
  formError.value = ''
  try {
    const data = await deleteDailyReportRecord(id)
    if (data?.ok === false) {
      formError.value = data.error || '删除失败'
    }
    await loadRecords()
  } catch (e) {
    formError.value = e?.message || '删除失败'
  } finally {
    deletingRecordId.value = null
  }
}

function formatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

watch([parentFolder, scanDepth], () => {
  scheduleGitDetect()
})

onMounted(async () => {
  onRangeChange()
  await loadSettings()
  const styleData = await fetchStyles()
  if (styleData.ok) styles.value = styleData.styles
  await loadRecords()
})
</script>

<style scoped>
.daily-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 12px;
}

.field-span2 {
  grid-column: 1 / -1;
}

.range-tip {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

.range-nowrap {
  white-space: nowrap;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.hint-line {
  margin-top: 8px;
  font-size: 13px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.path-row {
  display: flex;
  gap: 8px;
}

.git-detect {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--bg-subtle, #f8fafc);
  border: 1px solid var(--border);
}

.git-detect-line {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.git-detect-line + .git-detect-line {
  margin-top: 4px;
}

.git-detect-label {
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin-right: 8px;
}

.git-detect-root {
  word-break: break-all;
}

.git-detect-dirty {
  margin-left: 4px;
}

.repo-toolbar {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.repo-list {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.repo-check {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

.muted {
  color: var(--text-secondary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-card {
  display: flex;
  flex-direction: column;
}

.report-text {
  min-height: 420px;
  resize: vertical;
  padding: 14px;
  line-height: 1.7;
  font-family: inherit;
  font-size: 14px;
}

.head-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.record-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.record-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.record-repos {
  margin: 6px 0;
  font-size: 11px;
}

.record-preview {
  font-size: 12px;
  white-space: pre-wrap;
  margin: 0;
  max-height: 120px;
  overflow: hidden;
}

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .field-span2 {
    grid-column: auto;
  }
}
</style>
