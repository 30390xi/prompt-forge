import { bindAbortSignal } from '../shared/bindAbortSignal'
import { toIpcPlain } from '../shared/ipcPayload'

const api = window.promptForge

if (!api) {
  console.warn('Prompt Forge API 未注入：请在 Electron 中运行本应用')
}

async function noop() {
  return { ok: false, error: '请在 Electron 桌面应用中运行' }
}

const safe = api ?? {
  enhance: noop,
  cancelEnhance: () => {},
  fetchStyles: noop,
  addStyle: noop,
  deleteStyle: noop,
  fetchHistory: noop,
  deleteHistory: noop,
  fetchWorkspaceSettings: noop,
  saveWorkspaceSettings: noop,
  scanRepos: noop,
  detectGitDirectory: noop,
  generateDailyReport: noop,
  polishDailyReport: noop,
  fetchDailyReportRecords: noop,
  deleteDailyReportRecord: noop,
  pickFolder: noop,
  saveTextFile: noop,
  fetchProviders: noop,
  createProvider: noop,
  updateProvider: noop,
  deleteProvider: noop,
  activateProvider: noop
}

export async function enhance(draft, style, signal) {
  const requestId = crypto.randomUUID()
  bindAbortSignal(signal, () => safe.cancelEnhance(requestId))
  return safe.enhance(draft, style, requestId)
}

export function fetchStyles() {
  return safe.fetchStyles()
}

export function addStyle(id, name, guide) {
  return safe.addStyle(id, name, guide)
}

export function deleteStyle(dbId) {
  return safe.deleteStyle(dbId)
}

export function fetchHistory(page, size = 10) {
  return safe.fetchHistory(page, size)
}

export function deleteHistory(id) {
  return safe.deleteHistory(id)
}

export function fetchWorkspaceSettings() {
  return safe.fetchWorkspaceSettings()
}

export function saveWorkspaceSettings(settings) {
  return safe.saveWorkspaceSettings(toIpcPlain(settings))
}

export function scanRepos(body) {
  return safe.scanRepos(toIpcPlain(body))
}

export function detectGitDirectory(body) {
  return safe.detectGitDirectory(toIpcPlain(body))
}

export function generateDailyReport(body) {
  return safe.generateDailyReport(toIpcPlain(body))
}

export function polishDailyReport(draft, style) {
  return safe.polishDailyReport(draft, style)
}

export function fetchDailyReportRecords() {
  return safe.fetchDailyReportRecords()
}

export function deleteDailyReportRecord(id) {
  return safe.deleteDailyReportRecord(id)
}

export function pickFolder() {
  return safe.pickFolder()
}

export function saveTextFile(defaultName, content) {
  return safe.saveTextFile(defaultName, content)
}

export function fetchProviders() {
  return safe.fetchProviders()
}

export function createProvider(body) {
  return safe.createProvider(body)
}

export function updateProvider(id, body) {
  return safe.updateProvider(id, body)
}

export function deleteProvider(id) {
  return safe.deleteProvider(id)
}

export function activateProvider(id) {
  return safe.activateProvider(id)
}
