import { describe, expect, it, vi } from 'vitest'
import { bindAbortSignal } from '@shared/bindAbortSignal'

describe('bindAbortSignal', () => {
  it('calls onAbort when signal is already aborted', () => {
    const onAbort = vi.fn()
    const controller = new AbortController()
    controller.abort()
    bindAbortSignal(controller.signal, onAbort)
    expect(onAbort).toHaveBeenCalledOnce()
  })

  it('calls onAbort on abort event', () => {
    const onAbort = vi.fn()
    const controller = new AbortController()
    bindAbortSignal(controller.signal, onAbort)
    expect(onAbort).not.toHaveBeenCalled()
    controller.abort()
    expect(onAbort).toHaveBeenCalledOnce()
  })

  it('ignores structured-clone broken signal (no addEventListener)', () => {
    const onAbort = vi.fn()
    bindAbortSignal({}, onAbort)
    bindAbortSignal({ aborted: true }, onAbort)
    expect(onAbort).not.toHaveBeenCalled()
  })
})
