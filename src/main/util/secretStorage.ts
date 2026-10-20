import { safeStorage } from 'electron'

const PREFIX = 'enc:'

export function encryptApiKey(plain: string): string {
  if (plain == null || plain === '') return ''
  if (safeStorage.isEncryptionAvailable()) {
    return PREFIX + safeStorage.encryptString(plain).toString('base64')
  }
  return plain
}

export function decryptApiKey(stored: string | null | undefined): string {
  if (stored == null || stored === '') return ''
  if (stored.startsWith(PREFIX) && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(stored.slice(PREFIX.length), 'base64'))
    } catch {
      return ''
    }
  }
  return stored
}

export function maskApiKey(key: string | null | undefined): string {
  if (key == null || key === '') return ''
  if (key.length <= 8) return '****'
  return key.substring(0, 4) + '…' + key.substring(key.length - 4)
}
