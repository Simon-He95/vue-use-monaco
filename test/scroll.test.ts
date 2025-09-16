import { describe, expect, it } from 'vitest'
import { createScrollWatcherForEditor } from '../src/utils/scroll'

describe('createScrollWatcherForEditor', () => {
  it('calls onPause when delta < 0 and onMaybeResume otherwise', () => {
    let paused = false
    let resumed = false
    let last = 50
    const editor = (() => {
      let handler: ((e: any) => void) | null = null
      return {
        getScrollTop() { return last },
        onDidScrollChange(cb: (e: any) => void) {
          handler = cb
          return {
            dispose() {
              handler = null
            },
          }
        },
        // helper to simulate
        __emit(e: any) { handler?.(e) },
      }
    })()
    const disp = createScrollWatcherForEditor(editor as any, {
      onPause: () => { paused = true },
      onMaybeResume: () => { resumed = true },
      getLast: () => last,
      setLast: (v: number) => { last = v },
    })
    // simulate up scroll (delta < 0)
    editor.__emit({ scrollTop: 40 })
    expect(paused).toBe(true)
    // simulate down scroll
    editor.__emit({ scrollTop: 100 })
    expect(resumed).toBe(true)
    disp?.dispose?.()
  })
})
