import type { SpecialTheme, ThemeInput } from 'shiki'
import type { WatchStopHandle } from 'vue'
import { shikiToMonaco } from '@shikijs/monaco'

import * as monaco from 'monaco-editor'
// @ts-expect-error bundle import for shiki
import { createHighlighter } from 'shiki/bundle/full'
import { computed, onUnmounted, watch } from 'vue'
import { detectLanguage, processedLanguage } from './code.detect'
import { isDark } from './isDark'

// Expose a function so consumers can proactively preload worker loaders
// without relying on module evaluation timing.
export async function preloadMonacoWorkers(options?: {
  /**
   * If true, also fetch each worker URL to warm the HTTP cache (best-effort).
   */
  fetch?: boolean
}): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  // Recreate the same URLs as used by MonacoEnvironment
  const workerUrlJson = new URL(
    'monaco-editor/esm/vs/language/json/json.worker.js',
    import.meta.url,
  )
  const workerUrlCss = new URL(
    'monaco-editor/esm/vs/language/css/css.worker.js',
    import.meta.url,
  )
  const workerUrlHtml = new URL(
    'monaco-editor/esm/vs/language/html/html.worker.js',
    import.meta.url,
  )
  const workerUrlTs = new URL(
    'monaco-editor/esm/vs/language/typescript/ts.worker.js',
    import.meta.url,
  )
  const workerUrlEditor = new URL(
    'monaco-editor/esm/vs/editor/editor.worker.js',
    import.meta.url,
  )

  const unique = Array.from(
    new Set([
      String(workerUrlJson),
      String(workerUrlCss),
      String(workerUrlHtml),
      String(workerUrlTs),
      String(workerUrlEditor),
    ]),
  )

  const workerUrlByLabel: Record<string, URL> = {
    json: workerUrlJson,
    css: workerUrlCss,
    scss: workerUrlCss,
    less: workerUrlCss,
    html: workerUrlHtml,
    handlebars: workerUrlHtml,
    razor: workerUrlHtml,
    typescript: workerUrlTs,
    javascript: workerUrlTs,
  }

  try {
    for (const href of unique) {
      if (
        !document.querySelector(`link[rel="modulepreload"][href="${href}"]`)
      ) {
        const link = document.createElement('link')
        link.rel = 'modulepreload'
        link.href = href
        document.head.appendChild(link)
      }
    }

    if (options?.fetch) {
      // best-effort fetch to warm caches; do not throw on individual failures
      await Promise.all(
        unique.map((u) =>
          fetch(u, { method: 'GET', cache: 'force-cache' }).catch(
            () => undefined,
          ),
        ),
      )
    }
    // eslint-disable-next-line no-restricted-globals
    ;(self as any).MonacoEnvironment = {
      getWorker(_: any, label: string) {
        const url = workerUrlByLabel[label] ?? workerUrlEditor
        return new Worker(url, { type: 'module' })
      },
    }
  } catch {
    // swallow errors - preloading is best-effort
  }
}

preloadMonacoWorkers()

export type MonacoEditorInstance = monaco.editor.IStandaloneCodeEditor
export type { ThemeInput }

let themesRegistered = false
let languagesRegistered = false
let themeRegisterPromise: Promise<void> | null = null
let currentThemes: (ThemeInput | string | SpecialTheme)[] = []
let currentLanguages: string[] = []
const disposals: monaco.IDisposable[] = []

// shallow array equality (order-sensitive)
function arraysEqual<T>(
  a: readonly T[] | null | undefined,
  b: readonly T[] | null | undefined,
) {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

async function registerMonacoThemes(
  themes: (ThemeInput | string | SpecialTheme)[],
  languages: string[],
) {
  registerMonacoLanguages(languages)

  // If nothing changed, skip heavy work
  if (
    themesRegistered &&
    arraysEqual(themes, currentThemes) &&
    arraysEqual(languages, currentLanguages)
  ) {
    return
  }

  // Create highlighter (heavy) and only mark as registered on success.
  try {
    const highlighter = await createHighlighter({
      themes,
      langs: languages,
    })
    shikiToMonaco(highlighter, monaco)

    // Mark state after successful registration so failures don't block retries
    themesRegistered = true
    currentThemes = themes
    currentLanguages = languages
  } catch (e) {
    // reset the global promise so callers can retry later
    themeRegisterPromise = null
    throw e
  }
}

function registerMonacoLanguages(languages: string[]) {
  // If nothing changed, skip
  if (languagesRegistered && arraysEqual(languages, currentLanguages)) {
    return
  }

  // Only register languages that Monaco doesn't already know about.
  const existing = new Set(monaco.languages.getLanguages().map((l) => l.id))
  for (const lang of languages) {
    if (!existing.has(lang)) {
      try {
        monaco.languages.register({ id: lang })
      } catch {
        // ignore registration errors for unknown/unsupported ids
      }
    }
  }

  languagesRegistered = true
  currentLanguages = languages
}

export type MonacoTheme =
  | 'andromeeda'
  | 'aurora-x'
  | 'ayu-dark'
  | 'catppuccin-frappe'
  | 'catppuccin-latte'
  | 'catppuccin-macchiato'
  | 'catppuccin-mocha'
  | 'dark-plus'
  | 'dracula'
  | 'dracula-soft'
  | 'everforest-dark'
  | 'everforest-light'
  | 'github-dark'
  | 'github-dark-default'
  | 'github-dark-dimmed'
  | 'github-dark-high-contrast'
  | 'github-light'
  | 'github-light-default'
  | 'github-light-high-contrast'
  | 'gruvbox-dark-hard'
  | 'gruvbox-dark-medium'
  | 'gruvbox-dark-soft'
  | 'gruvbox-light-hard'
  | 'gruvbox-light-medium'
  | 'gruvbox-light-soft'
  | 'houston'
  | 'kanagawa-dragon'
  | 'kanagawa-lotus'
  | 'kanagawa-wave'
  | 'laserwave'
  | 'light-plus'
  | 'material-theme'
  | 'material-theme-darker'
  | 'material-theme-lighter'
  | 'material-theme-ocean'
  | 'material-theme-palenight'
  | 'min-dark'
  | 'min-light'
  | 'monokai'
  | 'night-owl'
  | 'nord'
  | 'one-dark-pro'
  | 'one-light'
  | 'plastic'
  | 'poimandres'
  | 'red'
  | 'rose-pine'
  | 'rose-pine-dawn'
  | 'rose-pine-moon'
  | 'slack-dark'
  | 'slack-ochin'
  | 'snazzy-light'
  | 'solarized-dark'
  | 'solarized-light'
  | 'synthwave-84'
  | 'tokyo-night'
  | 'vesper'
  | 'vitesse-black'
  | 'vitesse-dark'
  | 'vitesse-light'
  | ThemeInput
  | string
  | SpecialTheme
export type MonacoLanguage =
  | 'abap'
  | 'actionscript-3'
  | 'ada'
  | 'angular-html'
  | 'angular-ts'
  | 'apache'
  | 'apex'
  | 'apl'
  | 'applescript'
  | 'ara'
  | 'asciidoc'
  | 'asm'
  | 'astro'
  | 'awk'
  | 'ballerina'
  | 'bat'
  | 'beancount'
  | 'berry'
  | 'bibtex'
  | 'bicep'
  | 'blade'
  | 'bsl'
  | 'c'
  | 'cadence'
  | 'cairo'
  | 'clarity'
  | 'clojure'
  | 'cmake'
  | 'cobol'
  | 'codeowners'
  | 'codeql'
  | 'coffee'
  | 'common-lisp'
  | 'coq'
  | 'cpp'
  | 'crystal'
  | 'csharp'
  | 'css'
  | 'csv'
  | 'cue'
  | 'cypher'
  | 'd'
  | 'dart'
  | 'dax'
  | 'desktop'
  | 'diff'
  | 'docker'
  | 'dotenv'
  | 'dream-maker'
  | 'edge'
  | 'elixir'
  | 'elm'
  | 'emacs-lisp'
  | 'erb'
  | 'erlang'
  | 'fennel'
  | 'fish'
  | 'fluent'
  | 'fortran-fixed-form'
  | 'fortran-free-form'
  | 'fsharp'
  | 'gdresource'
  | 'gdscript'
  | 'gdshader'
  | 'genie'
  | 'gherkin'
  | 'git-commit'
  | 'git-rebase'
  | 'gleam'
  | 'glimmer-js'
  | 'glimmer-ts'
  | 'glsl'
  | 'gnuplot'
  | 'go'
  | 'graphql'
  | 'groovy'
  | 'hack'
  | 'haml'
  | 'handlebars'
  | 'haskell'
  | 'haxe'
  | 'hcl'
  | 'hjson'
  | 'hlsl'
  | 'html'
  | 'html-derivative'
  | 'http'
  | 'hxml'
  | 'hy'
  | 'imba'
  | 'ini'
  | 'java'
  | 'javascript'
  | 'jinja'
  | 'jison'
  | 'json'
  | 'json5'
  | 'jsonc'
  | 'jsonl'
  | 'jsonnet'
  | 'jssm'
  | 'jsx'
  | 'julia'
  | 'kotlin'
  | 'kusto'
  | 'latex'
  | 'lean'
  | 'less'
  | 'liquid'
  | 'llvm'
  | 'log'
  | 'logo'
  | 'lua'
  | 'luau'
  | 'make'
  | 'markdown'
  | 'marko'
  | 'matlab'
  | 'mdc'
  | 'mdx'
  | 'mermaid'
  | 'mipsasm'
  | 'mojo'
  | 'move'
  | 'narrat'
  | 'nextflow'
  | 'nginx'
  | 'nim'
  | 'nix'
  | 'nushell'
  | 'objective-c'
  | 'objective-cpp'
  | 'ocaml'
  | 'pascal'
  | 'perl'
  | 'php'
  | 'plsql'
  | 'po'
  | 'polar'
  | 'postcss'
  | 'powerquery'
  | 'powershell'
  | 'prisma'
  | 'prolog'
  | 'proto'
  | 'pug'
  | 'puppet'
  | 'purescript'
  | 'python'
  | 'qml'
  | 'qmldir'
  | 'qss'
  | 'r'
  | 'racket'
  | 'raku'
  | 'razor'
  | 'reg'
  | 'regexp'
  | 'rel'
  | 'riscv'
  | 'rst'
  | 'ruby'
  | 'rust'
  | 'sas'
  | 'sass'
  | 'scala'
  | 'scheme'
  | 'scss'
  | 'sdbl'
  | 'shaderlab'
  | 'shellscript'
  | 'shellsession'
  | 'smalltalk'
  | 'solidity'
  | 'soy'
  | 'sparql'
  | 'splunk'
  | 'sql'
  | 'ssh-config'
  | 'stata'
  | 'stylus'
  | 'svelte'
  | 'swift'
  | 'system-verilog'
  | 'systemd'
  | 'talonscript'
  | 'tasl'
  | 'tcl'
  | 'templ'
  | 'terraform'
  | 'tex'
  | 'toml'
  | 'ts-tags'
  | 'tsv'
  | 'tsx'
  | 'turtle'
  | 'twig'
  | 'typescript'
  | 'typespec'
  | 'typst'
  | 'v'
  | 'vala'
  | 'vb'
  | 'verilog'
  | 'vhdl'
  | 'viml'
  | 'vue'
  | 'vue-html'
  | 'vyper'
  | 'wasm'
  | 'wenyan'
  | 'wgsl'
  | 'wikitext'
  | 'wit'
  | 'wolfram'
  | 'xml'
  | 'xsl'
  | 'yaml'
  | 'zenscript'
  | 'zig'
  | string

export interface MonacoOptions
  extends monaco.editor.IStandaloneEditorConstructionOptions {
  MAX_HEIGHT?: number | string
  readOnly?: boolean
  themes?: MonacoTheme[]
  languages?: MonacoLanguage[]
  theme?: string
  isCleanOnBeforeCreate?: boolean
  // 添加在编辑器创建之前的钩子
  onBeforeCreate?: (
    monaco: typeof import('monaco-editor'),
  ) => monaco.IDisposable[]
}

/**
 * useMonaco 组合式函数
 *
 * 提供 Monaco 编辑器的创建、销毁、内容/主题/语言更新等能力。
 * 支持主题自动切换、语言高亮、代码更新等功能。
 *
 * @param {MonacoOptions} [monacoOptions] - 编辑器初始化配置，支持 Monaco 原生配置及扩展项
 * @param {number | string} [monacoOptions.MAX_HEIGHT] - 编辑器最大高度，可以是数字（像素）或 CSS 字符串（如 '100%', 'calc(100vh - 100px)'）
 * @param {boolean} [monacoOptions.readOnly] - 是否为只读模式
 * @param {MonacoTheme[]} [monacoOptions.themes] - 主题数组，至少包含两个主题：[暗色主题, 亮色主题]
 * @param {MonacoLanguage[]} [monacoOptions.languages] - 支持的编程语言数组
 * @param {string} [monacoOptions.theme] - 初始主题名称
 * @param {boolean} [monacoOptions.isCleanOnBeforeCreate] - 是否在创建前清理之前注册的资源, 默认为 true
 * @param {(monaco: typeof import('monaco-editor')) => monaco.IDisposable[]} [monacoOptions.onBeforeCreate] - 编辑器创建前的钩子函数
 *
 * @returns {{
 *   createEditor: (container: HTMLElement, code: string, language: string) => Promise<monaco.editor.IStandaloneCodeEditor>,
 *   cleanupEditor: () => void,
 *   updateCode: (newCode: string, codeLanguage: string) => void,
 *   setTheme: (theme: MonacoTheme) => void,
 *   setLanguage: (language: MonacoLanguage) => void,
 *   getCurrentTheme: () => string,
 *   getEditor: () => typeof monaco.editor,
 *   getEditorView: () => monaco.editor.IStandaloneCodeEditor | null
 * }} 返回对象包含以下方法和属性：
 *
 * @property {Function} createEditor - 创建并挂载 Monaco 编辑器到指定容器
 * @property {Function} cleanupEditor - 销毁编辑器并清理容器
 * @property {Function} updateCode - 更新编辑器内容和语言，必要时滚动到底部
 * @property {Function} setTheme - 切换编辑器主题
 * @property {Function} setLanguage - 切换编辑器语言
 * @property {Function} getCurrentTheme - 获取当前主题名称
 * @property {Function} getEditor - 获取 Monaco 的静态 editor 对象（用于静态方法调用）
 * @property {Function} getEditorView - 获取当前编辑器实例
 *
 * @throws {Error} 当主题数组不是数组或长度小于2时抛出错误
 *
 * @example
 * ```typescript
 * import { useMonaco } from 'vue-use-monaco'
 *
 * const { createEditor, updateCode, setTheme } = useMonaco({
 *   themes: ['vitesse-dark', 'vitesse-light'],
 *   languages: ['javascript', 'typescript'],
 *   readOnly: false
 * })
 *
 * // 创建编辑器
 * const editor = await createEditor(containerRef.value, 'console.log("hello")', 'javascript')
 *
 * // 更新代码
 * updateCode('console.log("world")', 'javascript')
 *
 * // 切换主题
 * setTheme('vitesse-light')
 * ```
 */
const defaultLanguages = [
  'jsx',
  'tsx',
  'vue',
  'csharp',
  'python',
  'java',
  'c',
  'cpp',
  'rust',
  'go',
  'powershell',
  'sql',
  'json',
  'html',
  'javascript',
  'typescript',
  'css',
  'markdown',
  'xml',
  'yaml',
  'toml',
  'dockerfile',
  'kotlin',
  'objective-c',
  'objective-cpp',
  'php',
  'ruby',
  'scala',
  'svelte',
  'swift',
  'erlang',
  'angular-html',
  'angular-ts',
  'dart',
  'lua',
  'mermaid',
  'cmake',
  'nginx',
]
const defaultThemes: MonacoTheme[] = ['vitesse-dark', 'vitesse-light']
const defaultScrollbar = {
  verticalScrollbarSize: 8,
  horizontalScrollbarSize: 8,
  handleMouseWheel: true,
  /**
   * 是否始终消费鼠标滚轮事件，默认为 false
   * 如果为 true，则鼠标滚轮事件不会传递给其他元素
   */
  alwaysConsumeMouseWheel: false,
}
export function useMonaco(monacoOptions: MonacoOptions = {}) {
  // 清除之前在 onBeforeCreate 中注册的资源
  if (monacoOptions.isCleanOnBeforeCreate ?? true)
    disposals.forEach((d) => d.dispose())
  // 释放已处理的引用，避免数组无限增长
  if (monacoOptions.isCleanOnBeforeCreate ?? true) disposals.length = 0
  let editorView: monaco.editor.IStandaloneCodeEditor | null = null
  const themes = monacoOptions.themes ?? defaultThemes
  if (!Array.isArray(themes) || themes.length < 2) {
    throw new Error(
      'Monaco themes must be an array with at least two themes: [darkTheme, lightTheme]',
    )
  }
  const languages = monacoOptions.languages ?? defaultLanguages
  const MAX_HEIGHT = monacoOptions.MAX_HEIGHT ?? 500

  // 处理 MAX_HEIGHT，转换为数值和CSS字符串
  const getMaxHeightValue = (): number => {
    if (typeof MAX_HEIGHT === 'number') {
      return MAX_HEIGHT
    }
    // 如果是字符串，尝试解析数值部分（用于高度比较）
    const match = MAX_HEIGHT.match(/^(\d+(?:\.\d+)?)/)
    return match ? Number.parseFloat(match[1]) : 500 // 默认值
  }

  const getMaxHeightCSS = (): string => {
    if (typeof MAX_HEIGHT === 'number') {
      return `${MAX_HEIGHT}px`
    }
    return MAX_HEIGHT
  }

  const maxHeightValue = getMaxHeightValue()
  const maxHeightCSS = getMaxHeightCSS()
  let lastContainer: HTMLElement | null = null
  let lastKnownCode: string | null = null
  // 合并同一帧内的多次 updateCode 调用，降低布局与 DOM 抖动
  let pendingUpdate: { code: string; lang: string } | null = null
  let rafId: number | null = null
  // 记录上一次应用的主题，避免重复 setTheme 引发不必要的工作
  let lastAppliedTheme: string | null = null
  const currentTheme = computed<string>(() =>
    isDark.value
      ? typeof themes[0] === 'string'
        ? themes[0]
        : (themes[0] as any).name
      : typeof themes[1] === 'string'
      ? themes[1]
      : (themes[1] as any).name,
  )
  let themeWatcher: WatchStopHandle | null = null

  // 在创建编辑器之前执行用户自定义逻辑
  if (monacoOptions.onBeforeCreate) {
    const disposal = monacoOptions.onBeforeCreate(monaco)
    if (disposal) disposals.push(...disposal)
  }
  async function createEditor(
    container: HTMLElement,
    code: string,
    language: string,
  ) {
    cleanupEditor()
    lastContainer = container

    // Stop any previous watcher
    if (themeWatcher) {
      themeWatcher()
      themeWatcher = null
    }

    // Register themes and languages
    if (!themeRegisterPromise) {
      themeRegisterPromise = registerMonacoThemes(themes, languages)
    }
    await themeRegisterPromise

    container.style.overflow = 'auto'
    container.style.maxHeight = maxHeightCSS

    editorView = monaco.editor.create(container, {
      value: code,
      language: processedLanguage(language) || language,
      theme: currentTheme.value,
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      automaticLayout: true,
      readOnly: monacoOptions.readOnly ?? true,
      contextmenu: false,
      scrollbar: {
        ...defaultScrollbar,
        ...(monacoOptions.scrollbar || {}),
      },
      ...monacoOptions,
    })

    // 记录初始内容，便于后续增量判断
    lastKnownCode = editorView.getValue()

    const padding = 16
    function updateHeight() {
      const lineCount = editorView!.getModel()?.getLineCount() ?? 1
      const lineHeight = editorView!.getOption(
        monaco.editor.EditorOption.lineHeight,
      )
      const height = Math.min(lineCount * lineHeight + padding, maxHeightValue)
      container.style.height = `${height}px`
    }

    updateHeight()
    editorView.onDidContentSizeChange?.(() => updateHeight())
    // 回退：如果某些情形下未触发 content-size 事件，监听内容变化
    editorView.onDidChangeModelContent(() => updateHeight())
    // keep lastKnownCode in sync when user or program changes content
    editorView.onDidChangeModelContent(() => {
      try {
        lastKnownCode = editorView!.getValue()
      } catch {
        // ignore
      }
    })

    // Scroll to the bottom if initialized with a scrollbar
    const model = editorView.getModel()
    const lineCount = model?.getLineCount() ?? 1
    if (container.scrollHeight >= maxHeightValue) {
      editorView.revealLine(lineCount)
    }

    // Watch for isDark changes and update the theme
    themeWatcher = watch(
      () => isDark.value,
      () => {
        if (currentTheme.value !== lastAppliedTheme) {
          monaco.editor.setTheme(currentTheme.value)
          lastAppliedTheme = currentTheme.value
        }
      },
      {
        flush: 'post',
        immediate: true,
      },
    )

    return editorView
  }

  onUnmounted(cleanupEditor)

  // Ensure cleanup stops the watcher
  function cleanupEditor() {
    if (rafId != null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    pendingUpdate = null
    if (editorView) {
      editorView.dispose()
      editorView = null
    }
    lastKnownCode = null
    if (lastContainer) {
      lastContainer.innerHTML = ''
      lastContainer = null
    }
    if (themeWatcher) {
      themeWatcher()
      themeWatcher = null
    }
  }

  // 将 updateCode 和 appendCode 提升为闭包内函数，便于相互调用且避免 this 绑定问题
  function appendCode(appendText: string, codeLanguage?: string) {
    if (!editorView) return
    const model = editorView.getModel()
    if (!model) return

    const processedCodeLanguage = codeLanguage
      ? processedLanguage(codeLanguage)
      : model.getLanguageId()
    if (
      processedCodeLanguage &&
      model.getLanguageId() !== processedCodeLanguage
    ) {
      monaco.editor.setModelLanguage(model, processedCodeLanguage)
    }

    // 计算插入位置：最后一行的末尾
    const lastLine = model.getLineCount()
    const lastColumn = model.getLineMaxColumn(lastLine)
    const range = new monaco.Range(lastLine, lastColumn, lastLine, lastColumn)

    // 如果编辑器是只读，executeEdits 不会生效，使用 model.applyEdits
    const isReadOnly = editorView.getOption(monaco.editor.EditorOption.readOnly)
    if (isReadOnly) {
      model.applyEdits([
        {
          range,
          text: appendText,
          forceMoveMarkers: true,
        },
      ])
    } else {
      // 使用 executeEdits 保留 undo/redo，source 字符串可自定义
      editorView.executeEdits('append', [
        {
          range,
          text: appendText,
          forceMoveMarkers: true,
        },
      ])
    }

    // sync lastKnownCode after edits
    try {
      lastKnownCode = model.getValue()
    } catch {
      // ignore
    }

    // 如果内容超过最大高度则滚动到底部
    const newLine = model.getLineCount()
    const container = editorView.getContainerDomNode?.()
    if (container && container.scrollHeight >= maxHeightValue) {
      editorView.revealLine(newLine)
    }
  }

  // 计算前后缀公共部分，并构造最小替换编辑（中间段替换）
  function applyMinimalEdit(prev: string, next: string) {
    if (!editorView) return
    const model = editorView.getModel()
    if (!model) return

    // 完全相同无需处理
    if (prev === next) return

    // 前缀
    let start = 0
    const minLen = Math.min(prev.length, next.length)
    while (start < minLen && prev.charCodeAt(start) === next.charCodeAt(start))
      start++

    // 后缀（避免与前缀重叠）
    let endPrev = prev.length - 1
    let endNext = next.length - 1
    while (
      endPrev >= start &&
      endNext >= start &&
      prev.charCodeAt(endPrev) === next.charCodeAt(endNext)
    ) {
      endPrev--
      endNext--
    }

    const replaceText = next.slice(start, endNext + 1)
    const rangeStart = model.getPositionAt(start)
    const rangeEnd = model.getPositionAt(endPrev + 1)
    const range = new monaco.Range(
      rangeStart.lineNumber,
      rangeStart.column,
      rangeEnd.lineNumber,
      rangeEnd.column,
    )

    const isReadOnly = editorView.getOption(monaco.editor.EditorOption.readOnly)
    const edit = [{ range, text: replaceText, forceMoveMarkers: true }]
    if (isReadOnly) model.applyEdits(edit)
    else editorView.executeEdits('minimal-replace', edit)
  }

  function flushPendingUpdate() {
    rafId = null
    if (!pendingUpdate) return
    if (!editorView) return
    const model = editorView.getModel()
    if (!model) return
    const { code: newCode, lang: codeLanguage } = pendingUpdate
    pendingUpdate = null
    const processedCodeLanguage = processedLanguage(codeLanguage)
    const languageId = model.getLanguageId()

    // 语言不同：切换语言并全量写入（避免增量带来的 tokenization 错配）
    if (languageId !== processedCodeLanguage) {
      if (processedCodeLanguage)
        monaco.editor.setModelLanguage(model, processedCodeLanguage)
      const prevLineCount = model.getLineCount()
      model.setValue(newCode)
      lastKnownCode = newCode
      const newLineCount = model.getLineCount()
      const container = editorView.getContainerDomNode?.()
      if (
        newLineCount !== prevLineCount &&
        container &&
        container.scrollHeight >= maxHeightValue
      ) {
        editorView.revealLine(newLineCount)
      }
      return
    }

    const prevCode = lastKnownCode ?? editorView.getValue()
    if (prevCode === newCode) return

    // 仅追加（流式场景最常见）
    if (newCode.startsWith(prevCode) && prevCode.length < newCode.length) {
      const suffix = newCode.slice(prevCode.length)
      if (suffix) appendCode(suffix, codeLanguage)
      lastKnownCode = newCode
      return
    }

    // 中间最小替换，减少 DOM 变动范围
    const prevLineCount = model.getLineCount()
    applyMinimalEdit(prevCode, newCode)
    lastKnownCode = newCode
    const newLineCount = model.getLineCount()
    const container = editorView.getContainerDomNode?.()
    if (
      newLineCount !== prevLineCount &&
      container &&
      container.scrollHeight >= maxHeightValue
    ) {
      editorView.revealLine(newLineCount)
    }
  }

  function updateCode(newCode: string, codeLanguage: string) {
    // 合并本帧内的多次调用
    pendingUpdate = { code: newCode, lang: codeLanguage }
    if (rafId != null) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(flushPendingUpdate)
  }

  return {
    createEditor,
    cleanupEditor,
    updateCode,
    appendCode,
    setTheme(theme: MonacoTheme) {
      if (themes.includes(theme)) {
        monaco.editor.setTheme(
          typeof theme === 'string' ? theme : (theme as any).name,
        )
      } else {
        console.warn(
          `Theme "${theme}" is not registered. Available themes: ${themes.join(
            ', ',
          )}`,
        )
      }
    },
    setLanguage(language: MonacoLanguage) {
      if (languages.includes(language)) {
        if (editorView) {
          const model = editorView.getModel()
          if (model && model.getLanguageId() !== language) {
            monaco.editor.setModelLanguage(model, language)
          }
        }
      } else {
        console.warn(
          `Language "${language}" is not registered. Available languages: ${languages.join(
            ', ',
          )}`,
        )
      }
    },
    getCurrentTheme() {
      return currentTheme.value
    },
    getEditor() {
      return monaco.editor
    },
    getEditorView() {
      return editorView
    },
  }
}

export { detectLanguage }
