<template>
  <div class="daily-root">
    <section class="card">
      <h2 class="card-title">多项目日报</h2>
      <p class="panel-desc">选择本地父目录后扫描 Git 仓库，按日期聚合提交与未提交改动，生成固定格式日报。</p>

      <div class="form-grid">
        <label class="field">
          <span>父目录（绝对路径）</span>
          <div class="path-row">
            <input v-model.trim="parentFolder" class="input input-grow" placeholder="/Users/you/work 或 C:\work" />
            <button type="button" class="btn btn-ghost" @click="browseFolder">选择文件夹</button>
            <button type="button" class="btn btn-primary" :disabled="saving" @click="saveSettings">保存</button>
          </div>
        </label>
        <label class="field">
          <span>日期</span>
          <input v-model="reportDate" type="date" class="input" />
        </label>
        <label class="field">
          <span>作者覆盖（可选）</span>
          <input v-model.trim="authorOverride" class="input" placeholder="默认使用各仓库 git user.name" />
        </label>
        <label class="field">
          <span>扫描深度</span>
          <select v-model.number="scanDepth" class="select">
            <option :value="0">仅直接子目录</option>
            <option :value="1">再向下一层嵌套</option>
          </select>
        </label>
      </div>

      <div class="repo-toolbar">
        <button type="button" class="btn btn-ghost" :disabled="scanning" @click="scanRepos">
          {{ scanning ? '扫描中…' : '发现仓库' }}
        </button>
        <button type="button" class="btn btn-primary" :disabled="generating || !repos.length" @click="generate">
          {{ generating ? '生成中…' : '一键生成' }}
        </button>
      </div>
      <p v-if="formError" class="error-text">{{ formError }}</p>

      <div v-if="repos.length" class="repo-list">
        <label v-for="r in repos" :key="r.path" class="repo-check">
          <input v-model="selectedRepos" type="checkbox" :value="r.path" />
          <span>{{ r.name }}</span>
          <span class="mono muted">{{ r.path }}</span>
        </label>
      </div>
    </section>

    <section class="card report-card">
      <div class="card-head">
        <h2 class="card-title">日报草稿</h2>
        <div class="head-actions">
          <select v-model="polishStyle" class="select">
            <option v-for="s in styles" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <button type="button" class="btn btn-ghost" :disabled="!report || polishing" @click="polish">
            {{ polishing ? '润色中…' : '用提示词增强润色' }}
          </button>
          <button type="button" class="btn btn-ghost" :disabled="!report" @click="copyReport">{{ copied ? '已复制' : '复制' }}</button>
          <button type="button" class="btn btn-ghost" :disabled="!report" @click="exportReport">导出 .txt</button>
        </div>
      </div>
      <div v-if="polishError" class="error-box">{{ polishError }}</div>
      <textarea v-model="report" class="report-text" placeholder="点击「一键生成」后在此显示日报"></textarea>
    </section>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">日报记录</h2>
        <button type="button" class="btn btn-ghost" @click="loadRecords">刷新</button>
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
            <button type="button" class="btn btn-ghost" @click="loadRecord(rec)">载入</button>
            <button type="button" class="btn btn-ghost" @click="copyRecord(rec)">复制</button>
            <button type="button" class="btn btn-danger-sm" @click="removeRecord(rec.id)">删除</button>
          </div>
          <p class="mono muted record-repos">{{ (rec.repos || []).join(', ') }}</p>
          <pre class="record-preview">{{ previewText(rec) }}</pre>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import {
  fetchWorkspaceSettings,
  saveWorkspaceSettings,
  scanRepos as apiScan,
  generateDailyReport,
  polishDailyReport,
  fetchStyles,
  pickFolder,
  saveTextFile,
  fetchDailyReportRecords,
  deleteDailyReportRecord
} from '../api.js'

const parentFolder = ref('')
const reportDate = ref(todayIso())
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
const formError = ref('')
const polishError = ref('')
const copied = ref(false)

function todayIso() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function loadSettings() {
  const data = await fetchWorkspaceSettings()
  if (data.ok && data.settings) {
    parentFolder.value = data.settings.parentFolder || ''
    scanDepth.value = data.settings.scanDepth ?? 1
    authorOverride.value = data.settings.authorOverride || ''
    retentionDays.value = data.settings.reportRetentionDays ?? 10
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
  } finally {
    saving.value = false
  }
}

async function browseFolder() {
  const data = await pickFolder()
  if (data.ok && data.path) {
    parentFolder.value = data.path
  }
}

async function scanRepos() {
  formError.value = ''
  scanning.value = true
  try {
    const data = await apiScan({ parentFolder: parentFolder.value, scanDepth: scanDepth.value })
    if (data.ok) {
      repos.value = data.repos || []
      selectedRepos.value = repos.value.map(r => r.path)
    } else {
      formError.value = data.error || '扫描失败'
    }
  } finally {
    scanning.value = false
  }
}

async function generate() {
  formError.value = ''
  generating.value = true
  try {
    const data = await generateDailyReport({
      date: reportDate.value,
      parentFolder: parentFolder.value,
      author: authorOverride.value || undefined,
      repos: selectedRepos.value
    })
    if (data.ok) {
      report.value = data.report
      await loadRecords()
    } else {
      formError.value = data.error || '生成失败'
    }
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
    } else {
      polishError.value = data.error || '润色失败'
    }
  } finally {
    polishing.value = false
  }
}

async function copyReport() {
  try {
    await navigator.clipboard.writeText(report.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    polishError.value = '复制失败'
  }
}

async function exportReport() {
  const data = await saveTextFile(`日报-${reportDate.value}.txt`, report.value)
  if (!data.ok) {
    const blob = new Blob([report.value], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `日报-${reportDate.value}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }
}

function previewText(rec) {
  const text = rec.polishedText || rec.rawText || ''
  return text.length > 280 ? text.slice(0, 280) + '…' : text
}

function loadRecord(rec) {
  report.value = rec.polishedText || rec.rawText
  reportDate.value = rec.reportDate
}

async function copyRecord(rec) {
  try {
    await navigator.clipboard.writeText(rec.polishedText || rec.rawText)
  } catch {
    formError.value = '复制失败'
  }
}

async function loadRecords() {
  const data = await fetchDailyReportRecords()
  if (data.ok) records.value = data.records || []
}

async function removeRecord(id) {
  await deleteDailyReportRecord(id)
  await loadRecords()
}

function formatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(async () => {
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
}
</style>
