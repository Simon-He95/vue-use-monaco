export function createHeightManager(container: HTMLElement, computeNext: () => number) {
  let raf: number | null = null
  let lastApplied = -1
  let suppressed = false
  function apply() {
    const next = computeNext()
    if (next === lastApplied)
      return
    suppressed = true
    container.style.height = `${next}px`
    lastApplied = next
    queueMicrotask(() => {
      suppressed = false
    })
  }
  function update() {
    if (raf != null)
      return
    raf = requestAnimationFrame(() => {
      raf = null
      apply()
    })
  }
  function dispose() {
    if (raf != null) {
      cancelAnimationFrame(raf)
      raf = null
    }
  }
  function isSuppressed() {
    return suppressed
  }
  function getLastApplied() {
    return lastApplied
  }
  return { update, dispose, isSuppressed, getLastApplied }
}
