import type * as monaco from '../monaco-shim'

export function createScrollWatcherForEditor(
  ed: { onDidScrollChange?: any, getScrollTop?: () => number },
  opts: {
    onPause: () => void
    onMaybeResume: () => void
    getLast: () => number
    setLast: (v: number) => void
  },
) {
  try {
    const initial = ed.getScrollTop?.() ?? 0
    opts.setLast(initial)
    const disp = ed.onDidScrollChange?.((e: any) => {
      const currentTop = e && typeof e.scrollTop === 'number' ? e.scrollTop : ed.getScrollTop?.() ?? 0
      const delta = currentTop - opts.getLast()
      opts.setLast(currentTop)
      if (delta < 0) {
        opts.onPause()
        return
      }
      opts.onMaybeResume()
    }) ?? null
    return disp as monaco.IDisposable | null
  }
  catch {
    return null
  }
}
