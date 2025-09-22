import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the local monaco shim so tests don't try to resolve the real
// 'monaco-editor' package entry via vite.
vi.mock('../src/monaco-shim', () => {
  const setTheme = vi.fn()
  const setModelLanguage = vi.fn()
  const editor = {
    setTheme,
    setModelLanguage,
    IStandaloneCodeEditor: class {},
    EditorOption: { lineHeight: 16 },
  }
  const languages = {
    getLanguages: () => [],
    register: () => {},
  }
  const Range = class {}
  return { default: { editor, languages, Range }, editor, languages, Range }
})

describe('setTheme behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should not call monaco.editor.setTheme when theme is already applied', async () => {
    const monaco = await import('../src/monaco-shim')
    const mod = await import('../src/index')
    const { setTheme } = mod.useMonaco({ themes: ['vitesse-dark', 'vitesse-light'] })
    // apply once
    await setTheme('vitesse-dark')
    // applying same theme again without force should be no-op
    await setTheme('vitesse-dark')
    expect(monaco.editor.setTheme).toHaveBeenCalled()
    // should only have been called once by the first application
    expect((monaco.editor.setTheme as any).mock.calls.length).toBe(1)
  })

  it('should call monaco.editor.setTheme when force=true even if same theme', async () => {
    const monaco = await import('../src/monaco-shim')
    const mod = await import('../src/index')
    const { setTheme } = mod.useMonaco({ themes: ['vitesse-dark', 'vitesse-light'] })
    await setTheme('vitesse-dark')
    // force reapplication
    await setTheme('vitesse-dark', true)
    expect((monaco.editor.setTheme as any).mock.calls.length).toBe(2)
  })
})
