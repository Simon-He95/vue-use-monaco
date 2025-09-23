import { describe, expect, it } from 'vitest'
import { createRafScheduler } from '../src/utils/raf'

describe('createRafScheduler', () => {
  it('schedules and cancels using global time source', async () => {
    const calls: Array<{ cb: FrameRequestCallback, id: number }> = []
    let nextId = 1

    const origRaf = (globalThis as any).requestAnimationFrame
    const origCancel = (globalThis as any).cancelAnimationFrame

    ;(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      const id = nextId++
      calls.push({ cb, id })
      return id
    }
    ;(globalThis as any).cancelAnimationFrame = (id: number) => {
      const idx = calls.findIndex(c => c.id === id)
      if (idx !== -1)
        calls.splice(idx, 1)
    }

    try {
      const s = createRafScheduler()
      let fired = false
      s.schedule('update', () => {
        fired = true
      })
      // find scheduled call and invoke
      expect(calls.length).toBe(1)
      const call = calls[0]
      // invoking should call cb
      call.cb(123)
      // simulate that the time source would have removed the entry when executed
      calls.splice(0, 1)
      expect(fired).toBe(true)

      // schedule and then cancel
      s.schedule('diff', () => {
        throw new Error('should not run')
      })
      expect(calls.length).toBe(1)
      s.cancel('diff')
      // cancelled
      expect(calls.length).toBe(0)
    }
    finally {
      ;(globalThis as any).requestAnimationFrame = origRaf
      ;(globalThis as any).cancelAnimationFrame = origCancel
    }
  })
})
