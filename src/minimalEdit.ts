export interface MinimalEditResult {
  start: number
  endPrevIncl: number
  endNextIncl: number
  replaceText: string
}

/**
 * Compute the minimal middle replacement between two UTF-16 strings.
 * Returns null when prev === next (no edits required).
 */
export function computeMinimalEdit(
  prev: string,
  next: string,
): MinimalEditResult | null {
  if (prev === next)
    return null
  let start = 0
  const minLen = Math.min(prev.length, next.length)
  while (start < minLen && prev.charCodeAt(start) === next.charCodeAt(start))
    start++

  let endPrev = prev.length - 1
  let endNext = next.length - 1
  while (
    endPrev >= start
    && endNext >= start
    && prev.charCodeAt(endPrev) === next.charCodeAt(endNext)
  ) {
    endPrev--
    endNext--
  }

  return {
    start,
    endPrevIncl: endPrev,
    endNextIncl: endNext,
    replaceText: next.slice(start, endNext + 1),
  }
}
