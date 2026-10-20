import { app, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { closeDatabase, openDatabase } from './db/database'
import { registerIpcHandlers } from './ipc/registerHandlers'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    title: 'Prompt Forge',
    webPreferences: {
      preload: (() => {
        const mjs = path.join(__dirname, '../preload/index.mjs')
        const js = path.join(__dirname, '../preload/index.js')
        return fs.existsSync(mjs) ? mjs : js
      })(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  const database = openDatabase()
  registerIpcHandlers(database)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDatabase()
})
