import type { TimeSource } from '../src/utils/raf'
import { describe, expect, it } from 'vitest'
import { createRafScheduler } from '../src/utils/raf'

describe('createRafScheduler', () => {
  it('schedules and cancels using injected time source', async () => {
    const calls: Array<{ cb: FrameRequestCallback, id: number }> = []
    let nextId = 1
    const ts: TimeSource = {
      requestAnimationFrame(cb) {
        const id = nextId++
        calls.push({ cb, id })
        return id
      },
      cancelAnimationFrame(id) {
        const idx = calls.findIndex(c => c.id === id)
        if (idx !== -1)
          calls.splice(idx, 1)
      },
    }
    const s = createRafScheduler(ts)
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
  })
})
