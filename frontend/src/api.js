const BASE = '/api'

async function request(path, options = {}) {
  const resp = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  return resp.json().catch(() => ({}))
}

export async function enhance(draft, style, signal) {
  const resp = await fetch(BASE + '/enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft, style }),
    signal
  })
  return resp.json()
}

export function fetchStyles() {
  return request('/styles')
}

export function addStyle(id, name, guide) {
  return request('/styles', {
    method: 'POST',
    body: JSON.stringify({ id, name, guide })
  })
}

export function deleteStyle(dbId) {
  return request('/styles/' + dbId, { method: 'DELETE' })
}

export function fetchHistory(page, size = 10) {
  return request(`/history?page=${page}&size=${size}`)
}

export function deleteHistory(id) {
  return request('/history/' + id, { method: 'DELETE' })
}

export function fetchWorkspaceSettings() {
  return request('/settings/workspace')
}

export function saveWorkspaceSettings(settings) {
  return request('/settings/workspace', {
    method: 'PUT',
    body: JSON.stringify(settings)
  })
}

export function scanRepos(body) {
  return request('/repos/scan', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export function generateDailyReport(body) {
  return request('/daily-report/generate', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export function polishDailyReport(draft, style) {
  return request('/daily-report/polish', {
    method: 'POST',
    body: JSON.stringify({ draft, style })
  })
}

export function listFs(path) {
  const q = path ? `?path=${encodeURIComponent(path)}` : ''
  return request('/fs/list' + q)
}

export function fetchProviders() {
  return request('/llm/providers')
}

export function createProvider(body) {
  return request('/llm/providers', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export function updateProvider(id, body) {
  return request('/llm/providers/' + id, {
    method: 'PUT',
    body: JSON.stringify(body)
  })
}

export function deleteProvider(id) {
  return request('/llm/providers/' + id, { method: 'DELETE' })
}

export function activateProvider(id) {
  return request('/llm/providers/' + id + '/activate', { method: 'POST' })
}
