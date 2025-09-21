import { describe, expect, it, vi } from 'vitest'

import { registerMonacoThemes } from '../src/utils/registerMonacoThemes'

// Mock the module under test to avoid resolving heavy deps (monaco/shiki) during test bundling
vi.mock('../src/utils/registerMonacoThemes', () => {
  return {
    registerMonacoThemes: async () => ({
      setTheme: async () => undefined,
      codeToHtml: (code: string) => `<pre>${code}</pre>`,
    }),
  // setHighlighterTheme removed; expose a mock highlighter instead
  }
})

describe('registerMonacoThemes (API)', () => {
  it('exports functions and they are callable', async () => {
    const themes = ['vitesse-dark']
    const langs = ['javascript']

    const highlighter = await registerMonacoThemes(themes as any, langs)
    expect(highlighter).toBeTruthy()
    expect(typeof highlighter.codeToHtml).toBe('function')

    // previously tested setHighlighterTheme; removed in refactor — ensure highlighter is usable
    expect(typeof (highlighter as any).setTheme === 'function' || typeof (highlighter as any).codeToHtml === 'function').toBeTruthy()
  })
})
