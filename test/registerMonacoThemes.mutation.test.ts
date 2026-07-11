import { describe, expect, it, vi } from 'vitest'

describe('registerMonacoThemes', () => {
  it('reuses an in-flight superset registration and skips completed coverage', async () => {
    vi.resetModules()

    let resolveHighlighter!: (value: object) => void
    const createHighlighter = vi.fn(() => new Promise<object>((resolve) => {
      resolveHighlighter = resolve
    }))
    const shikiToMonaco = vi.fn((_highlighter, monacoProxy) => {
      for (const language of ['javascript', 'json']) {
        monacoProxy.languages.setTokensProvider(language, {
          tokenize: () => ({ endState: {}, tokens: [] }),
        })
      }
    })
    vi.doMock('shiki', () => ({ createHighlighter }))
    vi.doMock('@shikijs/monaco', () => ({ shikiToMonaco }))
    vi.doMock('../src/monaco-shim', () => {
      const editor = { defineTheme: vi.fn(), setTheme: vi.fn(), create: vi.fn() }
      const languages = {
        getLanguages: () => [],
        register: vi.fn(),
        setTokensProvider: vi.fn(() => ({ dispose() {} })),
      }
      return { default: { editor, languages }, editor, languages, Range: class {} }
    })

    const { registerMonacoThemes } = await import('../src/utils/registerMonacoThemes')
    const fullRegistration = registerMonacoThemes(
      ['vitesse-dark', 'vitesse-light'],
      ['javascript', 'json'],
    )
    const subsetRegistration = registerMonacoThemes(['vitesse-dark'], ['javascript'])

    expect(subsetRegistration).toBe(fullRegistration)
    await vi.waitFor(() => expect(createHighlighter).toHaveBeenCalledTimes(1))
    resolveHighlighter({
      loadTheme: vi.fn(async () => undefined),
      loadLanguage: vi.fn(async () => undefined),
    })
    await fullRegistration
    await registerMonacoThemes(['vitesse-dark'], ['javascript'])

    expect(createHighlighter).toHaveBeenCalledTimes(1)
    expect(shikiToMonaco).toHaveBeenCalledTimes(1)
  })

  it('does not repeat registration for plaintext without a token provider', async () => {
    vi.resetModules()

    const createHighlighter = vi.fn(async () => ({
      loadTheme: vi.fn(async () => undefined),
      loadLanguage: vi.fn(async () => undefined),
    }))
    const shikiToMonaco = vi.fn((_highlighter, monacoProxy) => {
      monacoProxy.languages.setTokensProvider('typescript', {
        tokenize: () => ({ endState: {}, tokens: [] }),
      })
    })
    vi.doMock('shiki', () => ({ createHighlighter }))
    vi.doMock('@shikijs/monaco', () => ({ shikiToMonaco }))
    vi.doMock('../src/monaco-shim', () => {
      const editor = { defineTheme: vi.fn(), setTheme: vi.fn(), create: vi.fn() }
      const languages = {
        getLanguages: () => [],
        register: vi.fn(),
        setTokensProvider: vi.fn(() => ({ dispose() {} })),
      }
      return { default: { editor, languages }, editor, languages, Range: class {} }
    })

    const { registerMonacoThemes } = await import('../src/utils/registerMonacoThemes')
    await registerMonacoThemes(
      ['vitesse-dark', 'vitesse-light'],
      ['typescript', 'plaintext'],
    )
    await registerMonacoThemes(['vitesse-dark'], ['typescript', 'plaintext'])

    expect(createHighlighter).toHaveBeenCalledTimes(1)
    expect(shikiToMonaco).toHaveBeenCalledTimes(1)
  })

  it('uses the JavaScript regex engine by default to avoid loading Shiki WASM', async () => {
    vi.resetModules()

    const engine = { kind: 'javascript-regex' }
    const createJavaScriptRegexEngine = vi.fn(() => engine)
    const createHighlighter = vi.fn(async () => ({}))
    vi.doMock('shiki', () => ({ createHighlighter, createJavaScriptRegexEngine }))
    vi.doMock('@shikijs/monaco', () => ({ shikiToMonaco: vi.fn() }))
    vi.doMock('../src/monaco-shim', () => {
      const editor = { defineTheme: vi.fn(), setTheme: vi.fn(), create: vi.fn() }
      const languages = { getLanguages: () => [], register: vi.fn(), setTokensProvider: vi.fn() }
      return { default: { editor, languages }, editor, languages, Range: class {} }
    })

    const { registerMonacoThemes } = await import('../src/utils/registerMonacoThemes')

    await registerMonacoThemes(['vitesse-dark'], ['javascript'])

    expect(createJavaScriptRegexEngine).toHaveBeenCalledTimes(1)
    expect(createHighlighter).toHaveBeenCalledWith({
      themes: ['vitesse-dark'],
      langs: ['javascript'],
      engine,
    })
  })

  it('re-registers when themes array is mutated in place', async () => {
    vi.resetModules()

    const loadTheme = vi.fn(async () => undefined)
    const createHighlighter = vi.fn(async () => ({ loadTheme }))
    vi.doMock('shiki', () => ({ createHighlighter }))
    vi.doMock('@shikijs/monaco', () => ({ shikiToMonaco: vi.fn() }))
    vi.doMock('../src/monaco-shim', () => {
      const editor = { defineTheme: vi.fn(), setTheme: vi.fn(), create: vi.fn() }
      const languages = { getLanguages: () => [], register: vi.fn(), setTokensProvider: vi.fn() }
      return { default: { editor, languages }, editor, languages, Range: class {} }
    })

    const { registerMonacoThemes } = await import('../src/utils/registerMonacoThemes')

    const themes: any[] = ['vitesse-dark', 'vitesse-light']
    const langs = ['javascript']

    await registerMonacoThemes(themes, langs)
    themes.push('andromeeda')
    await registerMonacoThemes(themes, langs)

    // Shared Monaco highlighter is created once; additional themes are loaded incrementally.
    expect(createHighlighter).toHaveBeenCalledTimes(1)
    expect(loadTheme).toHaveBeenCalledWith('andromeeda')
    expect(loadTheme).toHaveBeenCalledTimes(1)
  })

  it('does not incrementally reload initially created languages', async () => {
    vi.resetModules()

    const loadLanguage = vi.fn(async () => undefined)
    const createHighlighter = vi.fn(async () => ({ loadLanguage }))
    vi.doMock('shiki', () => ({ createHighlighter }))
    vi.doMock('@shikijs/monaco', () => ({ shikiToMonaco: vi.fn() }))
    vi.doMock('../src/monaco-shim', () => {
      const editor = { defineTheme: vi.fn(), setTheme: vi.fn(), create: vi.fn() }
      const languages = { getLanguages: () => [], register: vi.fn(), setTokensProvider: vi.fn() }
      return { default: { editor, languages }, editor, languages, Range: class {} }
    })

    const { registerMonacoThemes } = await import('../src/utils/registerMonacoThemes')

    await registerMonacoThemes(['vitesse-dark', 'vitesse-light'], ['javascript'])
    await registerMonacoThemes(['vitesse-dark', 'vitesse-light'], ['javascript', 'json'])

    expect(createHighlighter).toHaveBeenCalledTimes(1)
    expect(loadLanguage).toHaveBeenCalledWith('json')
    expect(loadLanguage).toHaveBeenCalledTimes(1)
  })

  it('fully resets shared monaco highlighter state when clearing the cache', async () => {
    vi.resetModules()

    const createHighlighter = vi.fn(async () => ({ loadTheme: vi.fn(async () => undefined) }))
    vi.doMock('shiki', () => ({ createHighlighter }))
    vi.doMock('@shikijs/monaco', () => ({ shikiToMonaco: vi.fn() }))
    vi.doMock('../src/monaco-shim', () => {
      const editor = { defineTheme: vi.fn(), setTheme: vi.fn(), create: vi.fn() }
      const languages = { getLanguages: () => [], register: vi.fn(), setTokensProvider: vi.fn() }
      return { default: { editor, languages }, editor, languages, Range: class {} }
    })

    const {
      clearHighlighterCache,
      registerMonacoThemes,
    } = await import('../src/utils/registerMonacoThemes')

    await registerMonacoThemes(['vitesse-dark', 'vitesse-light'], ['javascript'])
    clearHighlighterCache()
    await registerMonacoThemes(['vitesse-dark', 'vitesse-light'], ['javascript'])

    expect(createHighlighter).toHaveBeenCalledTimes(2)
  })

  it('retries shared highlighter creation after a transient failure', async () => {
    vi.resetModules()

    const createHighlighter = vi.fn()
      .mockRejectedValueOnce(new Error('temporary highlighter failure'))
      .mockResolvedValue({
        loadTheme: vi.fn(async () => undefined),
        loadLanguage: vi.fn(async () => undefined),
      })
    vi.doMock('shiki', () => ({ createHighlighter }))
    vi.doMock('@shikijs/monaco', () => ({ shikiToMonaco: vi.fn() }))
    vi.doMock('../src/monaco-shim', () => {
      const editor = { defineTheme: vi.fn(), setTheme: vi.fn(), create: vi.fn() }
      const languages = { getLanguages: () => [], register: vi.fn(), setTokensProvider: vi.fn() }
      return { default: { editor, languages }, editor, languages, Range: class {} }
    })

    const { registerMonacoThemes } = await import('../src/utils/registerMonacoThemes')

    await expect(registerMonacoThemes(['vitesse-dark'], ['javascript']))
      .rejects.toThrow('temporary highlighter failure')
    await expect(registerMonacoThemes(['vitesse-dark'], ['javascript']))
      .resolves.toBeDefined()

    expect(createHighlighter).toHaveBeenCalledTimes(2)
  })

  it('does not call internal perf hooks unless explicitly enabled', async () => {
    vi.resetModules()

    let installedProvider: any
    const grammar = {
      tokenizeLine2: vi.fn(() => ({
        tokens: new Uint32Array([0, 1]),
        ruleStack: {},
      })),
    }
    const createHighlighter = vi.fn(async () => ({
      getLanguage: vi.fn(() => grammar),
    }))
    vi.doMock('shiki', () => ({ createHighlighter }))
    vi.doMock('@shikijs/monaco', () => ({
      shikiToMonaco: vi.fn((highlighter, monacoProxy) => {
        highlighter.getLanguage('javascript').tokenizeLine2('const quiet = true', {}, 500)
        monacoProxy.languages.setTokensProvider('javascript', {
          tokenize() {
            return {
              endState: {},
              tokens: [{ startIndex: 0, scopes: 'source.js' }],
            }
          },
        })
      }),
    }))
    vi.doMock('../src/monaco-shim', () => {
      const editor = { defineTheme: vi.fn(), setTheme: vi.fn(), create: vi.fn() }
      const languages = {
        getLanguages: () => [],
        register: vi.fn(),
        setTokensProvider: vi.fn((_lang, provider) => {
          installedProvider = provider
        }),
      }
      return { default: { editor, languages }, editor, languages, Range: class {} }
    })

    const recordTokenize = vi.fn()
    const recordGrammarTokenize = vi.fn()
    const recordThemeRegistration = vi.fn()
    delete (globalThis as any).__STREAM_MONACO_ENABLE_INTERNAL_PERF_HOOKS__
    ;(globalThis as any).__STREAM_MONACO_PERF__ = {
      recordTokenize,
      recordGrammarTokenize,
      recordThemeRegistration,
    }

    try {
      const { registerMonacoThemes } = await import('../src/utils/registerMonacoThemes')
      await registerMonacoThemes(['vitesse-dark'], ['javascript'])
      installedProvider.tokenize('const answer = 42', {})

      expect(recordTokenize).not.toHaveBeenCalled()
      expect(recordGrammarTokenize).not.toHaveBeenCalled()
      expect(recordThemeRegistration).not.toHaveBeenCalled()
    }
    finally {
      delete (globalThis as any).__STREAM_MONACO_PERF__
      delete (globalThis as any).__STREAM_MONACO_ENABLE_INTERNAL_PERF_HOOKS__
    }
  })

  it('records tokenization timing without weakening the fallback tokenizer', async () => {
    vi.resetModules()

    let installedProvider: any
    const createHighlighter = vi.fn(async () => ({}))
    vi.doMock('shiki', () => ({ createHighlighter }))
    vi.doMock('@shikijs/monaco', () => ({
      shikiToMonaco: vi.fn((_highlighter, monacoProxy) => {
        monacoProxy.languages.setTokensProvider('javascript', {
          tokenize() {
            throw new Error('tokenize failed')
          },
        })
      }),
    }))
    vi.doMock('../src/monaco-shim', () => {
      const editor = { defineTheme: vi.fn(), setTheme: vi.fn(), create: vi.fn() }
      const languages = {
        getLanguages: () => [],
        register: vi.fn(),
        setTokensProvider: vi.fn((_lang, provider) => {
          installedProvider = provider
        }),
      }
      return { default: { editor, languages }, editor, languages, Range: class {} }
    })

    const events: any[] = []
    ;(globalThis as any).__STREAM_MONACO_ENABLE_INTERNAL_PERF_HOOKS__ = true
    ;(globalThis as any).__STREAM_MONACO_PERF__ = {
      recordTokenize: (event: any) => events.push(event),
    }

    try {
      const { registerMonacoThemes } = await import('../src/utils/registerMonacoThemes')
      await registerMonacoThemes(['vitesse-dark'], ['javascript'])

      const result = installedProvider.tokenize('const answer = 42', {})

      expect(result).toEqual({
        endState: {},
        tokens: [{ startIndex: 0, scopes: '' }],
      })
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        language: 'javascript',
        lineLength: 'const answer = 42'.length,
        lineSample: 'const answer = 42',
        tokenCount: 1,
        failed: true,
      })
      expect(events[0].durationMs).toEqual(expect.any(Number))
    }
    finally {
      delete (globalThis as any).__STREAM_MONACO_PERF__
      delete (globalThis as any).__STREAM_MONACO_ENABLE_INTERNAL_PERF_HOOKS__
    }
  })

  it('does not install a Shiki provider that fails during initial tokenization', async () => {
    vi.resetModules()

    let installedProvider: any
    const createHighlighter = vi.fn(async () => ({}))
    vi.doMock('shiki', () => ({ createHighlighter }))
    vi.doMock('@shikijs/monaco', () => ({
      shikiToMonaco: vi.fn((_highlighter, monacoProxy) => {
        monacoProxy.languages.setTokensProvider('javascript', {
          getInitialState() {
            return {}
          },
          tokenize() {
            throw new TypeError("Cannot read properties of null (reading 'compileAG')")
          },
        })
      }),
    }))
    vi.doMock('../src/monaco-shim', () => {
      const editor = { defineTheme: vi.fn(), setTheme: vi.fn(), create: vi.fn() }
      const languages = {
        getLanguages: () => [],
        register: vi.fn(),
        setTokensProvider: vi.fn((_lang, provider) => {
          installedProvider = provider
        }),
      }
      return { default: { editor, languages }, editor, languages, Range: class {} }
    })

    const { registerMonacoThemes } = await import('../src/utils/registerMonacoThemes')
    await registerMonacoThemes(['vitesse-dark'], ['javascript'])

    expect(installedProvider).toBeUndefined()
  })

  it('retries installing a Shiki provider after initial tokenization fails', async () => {
    vi.resetModules()

    let attempt = 0
    const setTokensProvider = vi.fn()
    const createHighlighter = vi.fn(async () => ({}))
    const shikiToMonaco = vi.fn((_highlighter, monacoProxy) => {
      attempt++
      monacoProxy.languages.setTokensProvider('javascript', {
        getInitialState: () => ({}),
        tokenize() {
          if (attempt === 1)
            throw new TypeError("Cannot read properties of null (reading 'compileAG')")
          return { endState: {}, tokens: [{ startIndex: 0, scopes: 'source.js' }] }
        },
      })
    })
    vi.doMock('shiki', () => ({ createHighlighter }))
    vi.doMock('@shikijs/monaco', () => ({ shikiToMonaco }))
    vi.doMock('../src/monaco-shim', () => {
      const editor = { defineTheme: vi.fn(), setTheme: vi.fn(), create: vi.fn() }
      const languages = { getLanguages: () => [], register: vi.fn(), setTokensProvider }
      return { default: { editor, languages }, editor, languages, Range: class {} }
    })

    const { registerMonacoThemes } = await import('../src/utils/registerMonacoThemes')
    await registerMonacoThemes(['vitesse-dark'], ['javascript'])
    await registerMonacoThemes(['vitesse-dark'], ['javascript'])

    expect(shikiToMonaco).toHaveBeenCalledTimes(2)
    expect(setTokensProvider).toHaveBeenCalledOnce()
  })

  it('records theme registration timing when the perf hook is present', async () => {
    vi.resetModules()

    const createHighlighter = vi.fn(async () => ({}))
    const shikiToMonaco = vi.fn()
    vi.doMock('shiki', () => ({ createHighlighter }))
    vi.doMock('@shikijs/monaco', () => ({ shikiToMonaco }))
    vi.doMock('../src/monaco-shim', () => {
      const editor = { defineTheme: vi.fn(), setTheme: vi.fn(), create: vi.fn() }
      const languages = { getLanguages: () => [], register: vi.fn(), setTokensProvider: vi.fn() }
      return { default: { editor, languages }, editor, languages, Range: class {} }
    })

    const events: any[] = []
    ;(globalThis as any).__STREAM_MONACO_ENABLE_INTERNAL_PERF_HOOKS__ = true
    ;(globalThis as any).__STREAM_MONACO_PERF__ = {
      recordThemeRegistration: (event: any) => events.push(event),
    }

    try {
      const { registerMonacoThemes } = await import('../src/utils/registerMonacoThemes')
      await registerMonacoThemes(['vitesse-dark'], ['javascript'])

      expect(shikiToMonaco).toHaveBeenCalledTimes(1)
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        themes: 1,
        languages: 1,
        patchedMonaco: true,
      })
      expect(events[0].durationMs).toEqual(expect.any(Number))
      expect(events[0].ensureHighlighterMs).toEqual(expect.any(Number))
      expect(events[0].patchMonacoMs).toEqual(expect.any(Number))
    }
    finally {
      delete (globalThis as any).__STREAM_MONACO_PERF__
      delete (globalThis as any).__STREAM_MONACO_ENABLE_INTERNAL_PERF_HOOKS__
    }
  })

  it('records grammar tokenization timing when the perf hook is present', async () => {
    vi.resetModules()

    const grammar = {
      tokenizeLine2: vi.fn(() => ({
        tokens: new Uint32Array([0, 1, 4, 2]),
        ruleStack: {},
        stoppedEarly: true,
      })),
    }
    const createHighlighter = vi.fn(async () => ({
      getLanguage: vi.fn(() => grammar),
    }))
    vi.doMock('shiki', () => ({ createHighlighter }))
    vi.doMock('@shikijs/monaco', () => ({
      shikiToMonaco: vi.fn((highlighter) => {
        highlighter.getLanguage('javascript').tokenizeLine2('let slow = true', {}, 500)
      }),
    }))
    vi.doMock('../src/monaco-shim', () => {
      const editor = { defineTheme: vi.fn(), setTheme: vi.fn(), create: vi.fn() }
      const languages = { getLanguages: () => [], register: vi.fn(), setTokensProvider: vi.fn() }
      return { default: { editor, languages }, editor, languages, Range: class {} }
    })

    const events: any[] = []
    ;(globalThis as any).__STREAM_MONACO_ENABLE_INTERNAL_PERF_HOOKS__ = true
    ;(globalThis as any).__STREAM_MONACO_PERF__ = {
      recordGrammarTokenize: (event: any) => events.push(event),
    }

    try {
      const { registerMonacoThemes } = await import('../src/utils/registerMonacoThemes')
      await registerMonacoThemes(['vitesse-dark'], ['javascript'])

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        language: 'javascript',
        lineLength: 'let slow = true'.length,
        lineSample: 'let slow = true',
        stoppedEarly: true,
        tokenCount: 2,
      })
      expect(events[0].durationMs).toEqual(expect.any(Number))
    }
    finally {
      delete (globalThis as any).__STREAM_MONACO_PERF__
      delete (globalThis as any).__STREAM_MONACO_ENABLE_INTERNAL_PERF_HOOKS__
    }
  })
})
