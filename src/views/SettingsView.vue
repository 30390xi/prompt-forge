<template>
  <div class="settings-root">
    <section class="card">
      <h2 class="card-title">模型提供商</h2>
      <p class="panel-desc">
        支持 OpenAI 兼容的 chat/completions。密钥经系统加密存储（Electron safeStorage），界面仅显示掩码。全新安装默认使用
        <strong>xAI Grok</strong>，可在下方切换任意提供商为「当前使用」。
      </p>

      <div class="provider-list">
        <div
          v-for="p in providers"
          :key="p.id"
          class="provider-item"
          :class="{ active: p.active, editing: editingId === p.id }"
        >
          <template v-if="editingId === p.id">
            <div class="provider-edit">
              <p class="edit-title">编辑：{{ p.presetKey ? p.name : '自定义提供商' }}</p>
              <div class="form-grid compact">
                <label class="field">
                  <span>名称</span>
                  <input v-model.trim="editForm.name" class="input" />
                </label>
                <label class="field">
                  <span>Base URL</span>
                  <input v-model.trim="editForm.baseUrl" class="input" />
                </label>
                <label class="field">
                  <span>模型</span>
                  <input v-model.trim="editForm.model" class="input" />
                </label>
                <label class="field">
                  <span>API Key（留空则保留原值）</span>
                  <input
                    v-model="editForm.apiKey"
                    class="input"
                    type="password"
                    autocomplete="off"
                    placeholder="sk-..."
                  />
                </label>
              </div>
              <p v-if="cardError" class="error-text">{{ cardError }}</p>
              <div class="form-actions">
                <button type="button" class="btn btn-primary" :disabled="savingId === p.id" @click="saveEdit(p.id)">
                  {{ savingId === p.id ? '保存中…' : '保存' }}
                </button>
                <button type="button" class="btn btn-ghost" :disabled="savingId === p.id" @click="cancelEdit">
                  取消
                </button>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="provider-main">
              <strong>{{ p.name }}</strong>
              <span v-if="p.presetKey" class="preset-tag">{{ p.presetKey }}</span>
              <span v-if="p.active" class="active-tag">当前使用</span>
              <p class="provider-meta">{{ p.baseUrl }} · {{ p.model }}</p>
              <p class="provider-meta">API Key：{{ p.hasApiKey ? p.apiKeyMasked : '未配置' }}</p>
            </div>
            <div class="provider-actions">
              <button
                v-if="!p.active"
                type="button"
                class="btn btn-ghost"
                :disabled="editingId != null || activatingId != null"
                @click="activate(p.id)"
              >
                {{ activatingId === p.id ? '设置中…' : '设为当前' }}
              </button>
              <button
                type="button"
                class="btn btn-ghost"
                :disabled="editingId != null"
                @click="startEdit(p)"
              >
                编辑
              </button>
              <button
                v-if="!p.presetKey"
                type="button"
                class="btn btn-danger-sm"
                :disabled="editingId != null || deletingId === p.id"
                @click="remove(p.id)"
              >
                {{ deletingId === p.id ? '删除中…' : '删除' }}
              </button>
            </div>
          </template>
        </div>
      </div>

      <div class="hint-box">
        <p><strong>预设说明</strong></p>
        <ul>
          <li>
            <strong>xAI Grok（全新安装默认）</strong>：<code>https://api.x.ai/v1</code>，模型
            <code>grok-4.7</code>
          </li>
          <li>
            DeepSeek：<code>https://api.deepseek.com</code>，模型 <code>deepseek-flash</code>（亦可填
            <code>deepseek-v4-pro</code>；旧版 <code>deepseek-chat</code> 已退役）
          </li>
          <li>
            GLM Coding Plan：<code>https://open.bigmodel.cn/api/coding/paas/v4</code>，模型
            <code>glm-5.3</code>（须用 coding 端点，勿用 <code>/api/paas/v4</code>）
          </li>
          <li>
            Kimi Coding Plan：<code>https://api.kimi.com/coding/v1</code>，模型
            <code>kimi-for-coding</code>（亦可填 <code>kimi-for-coding-highspeed</code> / <code>k3</code>；勿用
            Moonshot 通用域名）
          </li>
        </ul>
        <p>在卡片上点击「设为当前」切换默认模型；「编辑」在卡片内修改，不会弹出系统窗口。环境变量 <code>LLM_API_KEY</code> 可作后备。</p>
      </div>
    </section>

    <section v-if="editingId == null" class="card">
      <h2 class="card-title">新增自定义提供商</h2>
      <div class="form-grid">
        <label class="field">
          <span>名称</span>
          <input v-model.trim="addForm.name" class="input" />
        </label>
        <label class="field">
          <span>Base URL</span>
          <input v-model.trim="addForm.baseUrl" class="input" placeholder="https://api.example.com/v1" />
        </label>
        <label class="field">
          <span>模型</span>
          <input v-model.trim="addForm.model" class="input" />
        </label>
        <label class="field">
          <span>API Key</span>
          <input v-model="addForm.apiKey" class="input" type="password" autocomplete="off" placeholder="sk-..." />
        </label>
      </div>
      <p v-if="addError" class="error-text">{{ addError }}</p>
      <div class="form-actions">
        <button type="button" class="btn btn-primary" :disabled="adding" @click="submitAdd">
          {{ adding ? '保存中…' : '添加' }}
        </button>
        <button type="button" class="btn btn-ghost" :disabled="adding" @click="resetAdd">清空</button>
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">工作区与数据</h2>
      <div class="form-grid">
        <label class="field">
          <span>日报记录保留天数</span>
          <input v-model.number="retentionDays" class="input" type="number" min="1" max="3650" />
        </label>
        <label class="field">
          <span>时区（日报统计日界）</span>
          <input v-model.trim="timezone" class="input" placeholder="Asia/Shanghai" />
        </label>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-primary" :disabled="wsSaving" @click="saveWorkspace">
          {{ wsSaving ? '保存中…' : '保存工作区设置' }}
        </button>
      </div>
      <p v-if="wsError" class="error-text">{{ wsError }}</p>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import {
  fetchProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  activateProvider,
  fetchWorkspaceSettings,
  saveWorkspaceSettings
} from '../api.js'

const providers = ref([])
const editingId = ref(null)
const savingId = ref(null)
const activatingId = ref(null)
const deletingId = ref(null)
const adding = ref(false)
const cardError = ref('')
const addError = ref('')
const retentionDays = ref(10)
const timezone = ref('Asia/Shanghai')
const wsSaving = ref(false)
const wsError = ref('')

const editForm = reactive({
  name: '',
  baseUrl: '',
  model: '',
  apiKey: ''
})

const addForm = reactive({
  name: '',
  baseUrl: '',
  model: '',
  apiKey: ''
})

async function load() {
  const data = await fetchProviders()
  if (data.ok) providers.value = data.providers || []
}

function startEdit(p) {
  cardError.value = ''
  editingId.value = p.id
  editForm.name = p.name
  editForm.baseUrl = p.baseUrl
  editForm.model = p.model
  editForm.apiKey = ''
}

function cancelEdit() {
  editingId.value = null
  cardError.value = ''
  editForm.name = ''
  editForm.baseUrl = ''
  editForm.model = ''
  editForm.apiKey = ''
}

async function saveEdit(id) {
  cardError.value = ''
  savingId.value = id
  try {
    const data = await updateProvider(id, {
      name: editForm.name,
      baseUrl: editForm.baseUrl,
      model: editForm.model,
      apiKey: editForm.apiKey || undefined
    })
    if (data.ok) {
      cancelEdit()
      await load()
    } else {
      cardError.value = data.error || '保存失败'
    }
  } finally {
    savingId.value = null
  }
}

function resetAdd() {
  addForm.name = ''
  addForm.baseUrl = ''
  addForm.model = ''
  addForm.apiKey = ''
  addError.value = ''
}

async function submitAdd() {
  addError.value = ''
  adding.value = true
  try {
    const data = await createProvider({
      name: addForm.name,
      baseUrl: addForm.baseUrl,
      model: addForm.model,
      apiKey: addForm.apiKey || undefined
    })
    if (data.ok) {
      resetAdd()
      await load()
    } else {
      addError.value = data.error || '添加失败'
    }
  } finally {
    adding.value = false
  }
}

async function remove(id) {
  deletingId.value = id
  try {
    await deleteProvider(id)
    await load()
  } finally {
    deletingId.value = null
  }
}

async function activate(id) {
  activatingId.value = id
  try {
    await activateProvider(id)
    await load()
  } finally {
    activatingId.value = null
  }
}

async function loadWorkspace() {
  const data = await fetchWorkspaceSettings()
  if (data.ok && data.settings) {
    retentionDays.value = data.settings.reportRetentionDays ?? 10
    timezone.value = data.settings.timezone || 'Asia/Shanghai'
  }
}

async function saveWorkspace() {
  wsError.value = ''
  wsSaving.value = true
  try {
    const data = await saveWorkspaceSettings({
      reportRetentionDays: retentionDays.value,
      timezone: timezone.value
    })
    if (!data.ok) wsError.value = data.error || '保存失败'
  } finally {
    wsSaving.value = false
  }
}

onMounted(async () => {
  await load()
  await loadWorkspace()
})
</script>

<style scoped>
.settings-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.provider-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.provider-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.provider-item.active {
  border-color: var(--primary);
  background: #fafbff;
}

.provider-item.editing {
  flex-direction: column;
  border-color: var(--primary);
  background: #fafbff;
}

.provider-edit {
  width: 100%;
}

.edit-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 10px;
}

.provider-main {
  flex: 1;
  min-width: 0;
}

.provider-meta {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.preset-tag,
.active-tag {
  font-size: 11px;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--primary-light);
  color: var(--primary);
}

.provider-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 12px;
}

.form-grid.compact {
  margin-top: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.form-actions {
  margin-top: 14px;
  display: flex;
  gap: 10px;
}

.hint-box {
  margin-top: 20px;
  padding: 14px;
  background: #f8fafc;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.7;
}

.hint-box ul {
  margin: 8px 0 8px 18px;
}

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .provider-item:not(.editing) {
    flex-direction: column;
  }
}
</style>
