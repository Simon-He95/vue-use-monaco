import { describe, expect, it } from 'vitest'
import { computeMinimalEdit } from '../src/minimalEdit'

describe('computeMinimalEdit', () => {
  it('no-op when equal', () => {
    expect(computeMinimalEdit('abc', 'abc')).toBeNull()
  })

  it('append only', () => {
    const res = computeMinimalEdit('abc', 'abcdef')!
    expect(res.start).toBe(3)
    expect(res.replaceText).toBe('def')
  })

  it('prepend only', () => {
    const res = computeMinimalEdit('world', 'hello world')!
    expect(res.start).toBe(0)
    expect(res.replaceText).toBe('hello ')
  })

  it('middle change', () => {
    const res = computeMinimalEdit('aXc', 'aYc')!
    expect(res.start).toBe(1)
    expect(res.replaceText).toBe('Y')
  })

  it('replace all (prev empty)', () => {
    const res = computeMinimalEdit('', 'foo')!
    expect(res.start).toBe(0)
    expect(res.replaceText).toBe('foo')
  })

  it('replace all (next empty)', () => {
    const res = computeMinimalEdit('bar', '')!
    expect(res.start).toBe(0)
    expect(res.replaceText).toBe('')
  })

  it('emoji (UTF-16) consistency', () => {
    // 😀 is surrogate pair (U+1F600)
    const prev = 'hi😀'
    const next = 'hi😀 there'
    const res = computeMinimalEdit(prev, next)!
    // start should be at prev.length (4 UTF-16 code units: h i surrogate pair)
    expect(res.start).toBe(prev.length)
    expect(res.replaceText).toBe(' there')
  })
})
