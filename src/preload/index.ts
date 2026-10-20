import { contextBridge, ipcRenderer } from 'electron'

function enhance(draft: string, style: string, signal?: AbortSignal) {
  const requestId = crypto.randomUUID()
  const promise = ipcRenderer.invoke('enhance', { draft, style, requestId })
  if (signal) {
    const onAbort = () => ipcRenderer.send('enhance:abort', requestId)
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  return promise
}

const api = {
  enhance,
  fetchStyles: () => ipcRenderer.invoke('styles:list'),
  addStyle: (id: string, name: string, guide: string) =>
    ipcRenderer.invoke('styles:add', { id, name, guide }),
  deleteStyle: (dbId: number) => ipcRenderer.invoke('styles:delete', dbId),
  fetchHistory: (page: number, size = 10) => ipcRenderer.invoke('history:list', page, size),
  deleteHistory: (id: number) => ipcRenderer.invoke('history:delete', id),
  fetchWorkspaceSettings: () => ipcRenderer.invoke('settings:workspace:get'),
  saveWorkspaceSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('settings:workspace:save', settings),
  scanRepos: (body: Record<string, unknown>) => ipcRenderer.invoke('repos:scan', body),
  generateDailyReport: (body: Record<string, unknown>) =>
    ipcRenderer.invoke('daily-report:generate', body),
  polishDailyReport: (draft: string, style: string) =>
    ipcRenderer.invoke('daily-report:polish', { draft, style }),
  fetchDailyReportRecords: () => ipcRenderer.invoke('daily-report:records'),
  deleteDailyReportRecord: (id: number) => ipcRenderer.invoke('daily-report:records:delete', id),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  saveTextFile: (defaultName: string, content: string) =>
    ipcRenderer.invoke('dialog:saveText', { defaultName, content }),
  fetchProviders: () => ipcRenderer.invoke('llm:providers:list'),
  createProvider: (body: Record<string, unknown>) => ipcRenderer.invoke('llm:providers:save', body),
  updateProvider: (id: number, body: Record<string, unknown>) =>
    ipcRenderer.invoke('llm:providers:save', { ...body, id }),
  deleteProvider: (id: number) => ipcRenderer.invoke('llm:providers:delete', id),
  activateProvider: (id: number) => ipcRenderer.invoke('llm:providers:activate', id)
}

contextBridge.exposeInMainWorld('promptForge', api)

export type PromptForgeApi = typeof api
