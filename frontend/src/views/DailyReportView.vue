<template>
  <div class="daily-root">
    <section class="card">
      <h2 class="card-title">多项目日报</h2>
      <p class="panel-desc">配置本地父目录后扫描 Git 仓库，按日期聚合提交与未提交改动，生成固定格式日报。</p>

      <div class="form-grid">
        <label class="field">
          <span>父目录（绝对路径）</span>
          <div class="path-row">
            <input v-model.trim="parentFolder" class="input input-grow" placeholder="/Users/you/work" />
            <button type="button" class="btn btn-ghost" @click="browse">浏览</button>
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

      <div v-if="browseOpen" class="browse-panel">
        <div class="browse-head">
          <span class="mono">{{ browsePath }}</span>
          <button type="button" class="btn btn-ghost" @click="browseUp">上级</button>
          <button type="button" class="btn btn-ghost" @click="selectBrowsePath">选为父目录</button>
          <button type="button" class="btn btn-ghost" @click="browseOpen = false">关闭</button>
        </div>
        <div class="browse-list">
          <button
            v-for="e in browseEntries"
            :key="e.path"
            type="button"
            class="browse-item"
            @click="enterBrowse(e.path)"
          >{{ e.name }}</button>
        </div>
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
  listFs
} from '../api.js'

const parentFolder = ref('')
const reportDate = ref(todayIso())
const authorOverride = ref('')
const scanDepth = ref(1)
const repos = ref([])
const selectedRepos = ref([])
const report = ref('')
const styles = ref([])
const polishStyle = ref('concise')

const scanning = ref(false)
const generating = ref(false)
const polishing = ref(false)
const saving = ref(false)
const formError = ref('')
const polishError = ref('')
const copied = ref(false)

const browseOpen = ref(false)
const browsePath = ref('')
const browseEntries = ref([])

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
  } finally {
    saving.value = false
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

function exportReport() {
  const blob = new Blob([report.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `日报-${reportDate.value}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

async function browse() {
  browseOpen.value = true
  await loadBrowse(parentFolder.value || undefined)
}

async function loadBrowse(path) {
  const data = await listFs(path)
  if (data.ok) {
    browsePath.value = data.current
    browseEntries.value = data.entries || []
  }
}

async function enterBrowse(path) {
  await loadBrowse(path)
}

async function browseUp() {
  const data = await listFs(browsePath.value)
  if (data.ok && data.parent) await loadBrowse(data.parent)
}

function selectBrowsePath() {
  parentFolder.value = browsePath.value
  browseOpen.value = false
}

onMounted(async () => {
  await loadSettings()
  const styleData = await fetchStyles()
  if (styleData.ok) styles.value = styleData.styles
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

.browse-panel {
  margin-top: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: #fafbff;
}

.browse-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.browse-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
}

.browse-item {
  text-align: left;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: #fff;
  cursor: pointer;
}

.browse-item:hover {
  border-color: var(--primary);
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

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
