/**
 * Electron ipcRenderer.invoke uses structured clone; Vue reactive proxies and
 * non-plain objects can throw "An object could not be cloned."
 */
export function toIpcPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
