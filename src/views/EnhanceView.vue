<template>
  <div class="enhance-root">
    <section v-if="showStylePanel" class="card style-panel">
      <h2 class="card-title">自定义风格</h2>
      <p class="panel-desc">风格指令会追加到增强提示词末尾，例如：按我们团队的 PRD 模板组织输出。</p>
      <div class="style-form">
        <input v-model.trim="styleForm.id" class="input" placeholder="标识，如 prd" maxlength="32" />
        <input v-model.trim="styleForm.name" class="input" placeholder="显示名称" maxlength="64" />
        <input v-model.trim="styleForm.guide" class="input input-grow" placeholder="风格指令" maxlength="1000" />
        <button class="btn btn-primary" :disabled="styleSubmitting" @click="submitStyle">添加</button>
      </div>
      <p v-if="styleError" class="error-text">{{ styleError }}</p>
      <div class="style-list">
        <div v-for="s in styles" :key="s.id" class="style-item">
          <span class="style-tag" :class="{ custom: !s.builtin }">{{ s.name }}</span>
          <span class="style-id">{{ s.id }}</span>
          <span v-if="!s.builtin" class="style-guide">{{ s.guide }}</span>
          <button v-if="!s.builtin" class="btn btn-danger-sm" @click="removeStyle(s.dbId)">删除</button>
        </div>
      </div>
    </section>

    <div class="workspace">
      <section class="card editor-card">
        <div class="card-head">
          <h2 class="card-title">原始草稿</h2>
          <span class="char-count">{{ draft.length }} 字</span>
        </div>
        <textarea
          v-model="draft"
          class="draft-input"
          placeholder="随手写下你的需求，例如：写个爬虫脚本"
          @input="onDraftInput"
        ></textarea>
        <div class="editor-actions">
          <select v-model="selectedStyle" class="select">
            <optgroup label="内置风格">
              <option v-for="s in builtinStyles" :key="s.id" :value="s.id">{{ s.name }}</option>
            </optgroup>
            <optgroup v-if="customStyles.length" label="自定义风格">
              <option v-for="s in customStyles" :key="s.id" :value="s.id">{{ s.name }}</option>
            </optgroup>
          </select>
          <button v-if="hasBackup" class="btn btn-ghost" @click="revert">↺ 恢复原文</button>
          <button
            v-if="!loading"
            class="btn btn-primary btn-enhance"
            :disabled="!draft.trim()"
            @click="runEnhance"
          >✦ 增强提示词</button>
          <button v-else class="btn btn-primary btn-enhance" @click="cancelEnhance">⋯ 正在增强，点击取消</button>
        </div>
      </section>

      <section class="card result-card">
        <div class="card-head">
          <h2 class="card-title">增强结果</h2>
          <button v-if="result" class="btn btn-ghost" @click="copyResult">{{ copied ? '已复制' : '复制' }}</button>
        </div>
        <div v-if="error" class="error-box">{{ error }}</div>
        <div v-else-if="loading" class="result-placeholder">
          <div class="spinner"></div>
          <p>模型正在改写你的草稿</p>
        </div>
        <pre v-else-if="result" class="result-text">{{ result }}</pre>
        <div v-else class="result-placeholder muted">
          <p>点击「增强提示词」，改写结果会显示在这里</p>
        </div>
      </section>
    </div>

    <section class="card history-card">
      <div class="card-head">
        <h2 class="card-title">增强历史</h2>
        <span class="history-total">共 {{ historyTotal }} 条</span>
      </div>
      <div v-if="history.length === 0" class="result-placeholder muted">
        <p>还没有历史记录</p>
      </div>
      <div v-else class="history-list">
        <div v-for="item in history" :key="item.id" class="history-item" @click="loadHistory(item)">
          <div class="history-main">
            <span class="style-tag">{{ styleName(item.style) }}</span>
            <p class="history-draft">{{ item.draft }}</p>
            <p class="history-result">{{ item.result }}</p>
          </div>
          <div class="history-side">
            <time>{{ formatTime(item.createdAt) }}</time>
            <button class="btn btn-danger-sm" @click.stop="removeHistory(item.id)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="historyTotalPages > 1" class="pagination">
        <button class="btn btn-ghost" :disabled="historyPage === 0" @click="loadHistoryPage(historyPage - 1)">上一页</button>
        <span>{{ historyPage + 1 }} / {{ historyTotalPages }}</span>
        <button class="btn btn-ghost" :disabled="historyPage >= historyTotalPages - 1" @click="loadHistoryPage(historyPage + 1)">下一页</button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { enhance, fetchStyles, addStyle, deleteStyle, fetchHistory, deleteHistory } from '../api.js'

const { showStylePanel } = defineProps({
  showStylePanel: { type: Boolean, default: false }
})

const draft = ref('')
const backup = ref('')
const hasBackup = ref(false)
const result = ref('')
const loading = ref(false)
const error = ref('')
const copied = ref(false)

const styles = ref([])
const selectedStyle = ref('default')

const history = ref([])
const historyPage = ref(0)
const historyTotalPages = ref(0)
const historyTotal = ref(0)

const styleForm = reactive({ id: '', name: '', guide: '' })
const styleError = ref('')
const styleSubmitting = ref(false)

let abortController = null

const builtinStyles = computed(() => styles.value.filter(s => s.builtin))
const customStyles = computed(() => styles.value.filter(s => !s.builtin))

function styleName(id) {
  const found = styles.value.find(s => s.id === id)
  return found ? found.name : id
}

function onDraftInput() {
  hasBackup.value = false
}

async function runEnhance() {
  if (!draft.value.trim() || loading.value) return
  loading.value = true
  error.value = ''
  result.value = ''
  backup.value = draft.value
  abortController = new AbortController()
  try {
    const data = await enhance(draft.value, selectedStyle.value, abortController.signal)
    if (data.ok) {
      result.value = data.prompt
      draft.value = data.prompt
      hasBackup.value = true
      loadHistoryPage(0)
    } else if (data.error !== '请求已取消') {
      error.value = data.error || '增强失败，请重试'
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      error.value = '请求失败，请检查网络与模型 API Key 配置'
    }
  } finally {
    loading.value = false
    abortController = null
  }
}

function cancelEnhance() {
  if (abortController) abortController.abort()
}

function revert() {
  draft.value = backup.value
  result.value = ''
  hasBackup.value = false
}

async function copyResult() {
  try {
    await navigator.clipboard.writeText(result.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    error.value = '复制失败，请手动选择文本复制'
  }
}

function loadHistory(item) {
  draft.value = item.draft
  result.value = item.result
  selectedStyle.value = styles.value.some(s => s.id === item.style) ? item.style : 'default'
  hasBackup.value = false
  error.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function loadStyles() {
  const data = await fetchStyles()
  if (data.ok) styles.value = data.styles
}

async function loadHistoryPage(page) {
  const data = await fetchHistory(page)
  if (data.ok) {
    history.value = data.content
    historyPage.value = data.page
    historyTotalPages.value = data.totalPages
    historyTotal.value = data.totalElements
  }
}

async function removeHistory(id) {
  await deleteHistory(id)
  loadHistoryPage(historyPage.value)
}

async function submitStyle() {
  styleError.value = ''
  if (!styleForm.id || !styleForm.guide) {
    styleError.value = '标识和风格指令不能为空'
    return
  }
  styleSubmitting.value = true
  try {
    const data = await addStyle(styleForm.id, styleForm.name, styleForm.guide)
    if (data.ok) {
      styleForm.id = ''
      styleForm.name = ''
      styleForm.guide = ''
      await loadStyles()
    } else {
      styleError.value = data.error || '添加失败'
    }
  } finally {
    styleSubmitting.value = false
  }
}

async function removeStyle(dbId) {
  await deleteStyle(dbId)
  await loadStyles()
  if (!styles.value.some(s => s.id === selectedStyle.value)) {
    selectedStyle.value = 'default'
  }
}

function formatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(() => {
  loadStyles()
  loadHistoryPage(0)
})
</script>
