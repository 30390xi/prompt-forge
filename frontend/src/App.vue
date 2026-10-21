<template>
  <div class="page">
    <header class="header">
      <div class="header-inner">
        <div class="logo">
          <span class="logo-icon">✦</span>
          <h1>Prompt Forge</h1>
          <span class="logo-sub">提示词增强 · 多项目日报</span>
        </div>
        <nav class="tabs">
          <button
            v-for="t in tabs"
            :key="t.id"
            type="button"
            class="tab"
            :class="{ active: activeTab === t.id }"
            @click="activeTab = t.id"
          >{{ t.label }}</button>
        </nav>
        <button
          v-if="activeTab === 'enhance'"
          type="button"
          class="btn btn-ghost"
          @click="showStylePanel = !showStylePanel"
        >
          {{ showStylePanel ? '收起风格管理' : '风格管理' }}
        </button>
      </div>
    </header>

    <main class="main">
      <EnhanceView v-if="activeTab === 'enhance'" :show-style-panel="showStylePanel" />
      <DailyReportView v-else-if="activeTab === 'daily'" />
      <SettingsView v-else-if="activeTab === 'settings'" />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import EnhanceView from './views/EnhanceView.vue'
import DailyReportView from './views/DailyReportView.vue'
import SettingsView from './views/SettingsView.vue'

const tabs = [
  { id: 'enhance', label: '提示词增强' },
  { id: 'daily', label: '多项目日报' },
  { id: 'settings', label: '模型设置' }
]

const activeTab = ref('enhance')
const showStylePanel = ref(false)
</script>

<style scoped>
.page {
  min-height: 100vh;
}

.header {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-inner {
  max-width: 1440px;
  margin: 0 auto;
  padding: 14px 32px;
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.logo {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.logo-icon {
  color: var(--primary);
  font-size: 20px;
  align-self: center;
}

.logo h1 {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.logo-sub {
  font-size: 13px;
  color: var(--text-secondary);
}

.tabs {
  display: flex;
  gap: 6px;
  flex: 1;
}

.tab {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
}

.tab.active {
  background: var(--primary-light);
  color: var(--primary);
  border-color: #c7d2fe;
  font-weight: 600;
}

.main {
  max-width: 1440px;
  margin: 0 auto;
  padding: 24px 32px 48px;
}

.btn {
  padding: 9px 18px;
  font-size: 14px;
  font-weight: 500;
}

.btn-ghost {
  background: transparent;
  color: var(--primary);
  border: 1px solid var(--border);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--primary-light);
  border-color: var(--primary);
}
</style>
