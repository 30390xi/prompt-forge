import type { PromptForgeApi } from './preload/index'

declare global {
  interface Window {
    promptForge: PromptForgeApi
  }
}

export {}
