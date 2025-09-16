// shallow array equality (order-sensitive)
export function arraysEqual<T>(
  a: readonly T[] | null | undefined,
  b: readonly T[] | null | undefined,
) {
  if (a === b)
    return true
  if (!a || !b)
    return false
  if (a.length !== b.length)
    return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i])
      return false
  }
  return true
}
