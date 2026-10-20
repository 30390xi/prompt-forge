<template>
  <div class="settings-root">
    <section class="card">
      <h2 class="card-title">模型提供商</h2>
      <p class="panel-desc">支持 OpenAI 兼容的 chat/completions。密钥保存在本地数据库，界面仅显示掩码。</p>

      <div class="provider-list">
        <div v-for="p in providers" :key="p.id" class="provider-item" :class="{ active: p.active }">
          <div class="provider-main">
            <strong>{{ p.name }}</strong>
            <span v-if="p.presetKey" class="preset-tag">{{ p.presetKey }}</span>
            <span v-if="p.active" class="active-tag">当前使用</span>
            <p class="provider-meta">{{ p.baseUrl }} · {{ p.model }}</p>
            <p class="provider-meta">API Key：{{ p.hasApiKey ? p.apiKeyMasked : '未配置' }}</p>
          </div>
          <div class="provider-actions">
            <button v-if="!p.active" type="button" class="btn btn-ghost" @click="activate(p.id)">设为当前</button>
            <button type="button" class="btn btn-ghost" @click="edit(p)">编辑</button>
            <button v-if="!p.presetKey" type="button" class="btn btn-danger-sm" @click="remove(p.id)">删除</button>
          </div>
        </div>
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">{{ form.id ? '编辑提供商' : '新增自定义提供商' }}</h2>
      <div class="form-grid">
        <label class="field">
          <span>名称</span>
          <input v-model.trim="form.name" class="input" />
        </label>
        <label class="field">
          <span>Base URL</span>
          <input v-model.trim="form.baseUrl" class="input" placeholder="https://api.example.com/v1" />
        </label>
        <label class="field">
          <span>模型</span>
          <input v-model.trim="form.model" class="input" />
        </label>
        <label class="field">
          <span>API Key（留空则保留原值）</span>
          <input v-model="form.apiKey" class="input" type="password" autocomplete="off" placeholder="sk-..." />
        </label>
      </div>
      <p v-if="formError" class="error-text">{{ formError }}</p>
      <div class="form-actions">
        <button type="button" class="btn btn-primary" :disabled="submitting" @click="submit">
          {{ submitting ? '保存中…' : '保存' }}
        </button>
        <button type="button" class="btn btn-ghost" @click="resetForm">清空</button>
      </div>

      <div class="hint-box">
        <p><strong>预设说明</strong></p>
        <ul>
          <li>DeepSeek：<code>https://api.deepseek.com</code>，模型 <code>deepseek-chat</code></li>
          <li>GLM Coding Plan（智谱 OpenAI 兼容）：<code>https://open.bigmodel.cn/api/paas/v4</code></li>
          <li>Kimi Coding Plan（Moonshot）：<code>https://api.moonshot.cn/v1</code></li>
        </ul>
        <p>也可设置环境变量 <code>LLM_API_KEY</code> 作为后备。</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { fetchProviders, createProvider, updateProvider, deleteProvider, activateProvider } from '../api.js'

const providers = ref([])
const submitting = ref(false)
const formError = ref('')

const form = reactive({
  id: null,
  name: '',
  baseUrl: '',
  model: '',
  apiKey: ''
})

async function load() {
  const data = await fetchProviders()
  if (data.ok) providers.value = data.providers || []
}

function edit(p) {
  form.id = p.id
  form.name = p.name
  form.baseUrl = p.baseUrl
  form.model = p.model
  form.apiKey = ''
}

function resetForm() {
  form.id = null
  form.name = ''
  form.baseUrl = ''
  form.model = ''
  form.apiKey = ''
  formError.value = ''
}

async function submit() {
  formError.value = ''
  submitting.value = true
  try {
    const payload = {
      name: form.name,
      baseUrl: form.baseUrl,
      model: form.model,
      apiKey: form.apiKey || undefined
    }
    const data = form.id
      ? await updateProvider(form.id, payload)
      : await createProvider(payload)
    if (data.ok) {
      resetForm()
      await load()
    } else {
      formError.value = data.error || '保存失败'
    }
  } finally {
    submitting.value = false
  }
}

async function remove(id) {
  await deleteProvider(id)
  await load()
}

async function activate(id) {
  await activateProvider(id)
  await load()
}

onMounted(load)
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
  .provider-item {
    flex-direction: column;
  }
}
</style>
