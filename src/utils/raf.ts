export interface TimeSource {
  requestAnimationFrame: (cb: FrameRequestCallback) => number
  cancelAnimationFrame: (id: number) => void
}

export function createRafScheduler(timeSource?: TimeSource) {
  const ts = timeSource ?? ({
    requestAnimationFrame: (cb: FrameRequestCallback) => requestAnimationFrame(cb),
    cancelAnimationFrame: (id: number) => cancelAnimationFrame(id),
  })
  const ids: Record<string, number | null> = {}
  function schedule(kind: string, cb: FrameRequestCallback) {
    const existing = ids[kind]
    if (existing != null) {
      try {
        ts.cancelAnimationFrame(existing)
      }
      catch { }
    }
    ids[kind] = ts.requestAnimationFrame((t) => {
      ids[kind] = null
      cb(t)
    })
  }
  function cancel(kind: string) {
    const id = ids[kind]
    if (id != null) {
      try {
        ts.cancelAnimationFrame(id)
      }
      catch { }
      ids[kind] = null
    }
  }
  return { schedule, cancel }
}
