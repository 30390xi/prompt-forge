/**
 * Wire a renderer AbortSignal to a cancel callback.
 * AbortSignal must NOT be passed through Electron contextBridge (structured clone
 * strips methods; a truthy `{}` breaks addEventListener). Keep signal handling in
 * the renderer and send only a requestId over IPC for cancel.
 */
export function bindAbortSignal(signal: unknown, onAbort: () => void): void {
  if (signal == null) return
  const s = signal as AbortSignal
  if (typeof s.addEventListener !== 'function') return
  if (s.aborted) {
    onAbort()
    return
  }
  s.addEventListener('abort', onAbort, { once: true })
}
