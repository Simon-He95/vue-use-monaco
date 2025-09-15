import type { SpecialTheme, ThemeInput } from 'shiki'
import type { WatchStopHandle } from 'vue'
import type { MonacoLanguage, MonacoOptions, MonacoTheme } from './type'

import { shikiToMonaco } from '@shikijs/monaco'
import * as monaco from 'monaco-editor'
// @ts-expect-error bundle import for shiki
import { createHighlighter } from 'shiki/bundle/full'
import { computed, onUnmounted, watch } from 'vue'
import { detectLanguage, processedLanguage } from './code.detect'
import { defaultLanguages, defaultScrollbar, defaultThemes } from './constant'
import { isDark } from './isDark'
import { computeMinimalEdit } from './minimalEdit'
import { preloadMonacoWorkers } from './preloadMonacoWorkers'

preloadMonacoWorkers()

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

async function registerMonacoThemes(
  themes: (ThemeInput | string | SpecialTheme)[],
  languages: string[],
) {
  registerMonacoLanguages(languages)

  // If nothing changed, skip heavy work
  if (
    themesRegistered
    && arraysEqual(themes, currentThemes)
    && arraysEqual(languages, currentLanguages)
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
  }
  catch (e) {
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
  const existing = new Set(monaco.languages.getLanguages().map(l => l.id))
  for (const lang of languages) {
    if (!existing.has(lang)) {
      try {
        monaco.languages.register({ id: lang })
      }
      catch {
        // ignore registration errors for unknown/unsupported ids
      }
    }
  }

  languagesRegistered = true
  currentLanguages = languages
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
 *   createDiffEditor: (
 *     container: HTMLElement,
 *     originalCode: string,
 *     modifiedCode: string,
 *     language: string,
 *   ) => Promise<monaco.editor.IStandaloneDiffEditor>,
 *   cleanupEditor: () => void,
 *   updateCode: (newCode: string, codeLanguage: string) => void,
 *   appendCode: (appendText: string, codeLanguage?: string) => void,
 *   updateDiff: (
 *     originalCode: string,
 *     modifiedCode: string,
 *     codeLanguage?: string,
 *   ) => void,
 *   updateOriginal: (newCode: string, codeLanguage?: string) => void,
 *   updateModified: (newCode: string, codeLanguage?: string) => void,
 *   appendOriginal: (appendText: string, codeLanguage?: string) => void,
 *   appendModified: (appendText: string, codeLanguage?: string) => void,
 *   setTheme: (theme: MonacoTheme) => void,
 *   setLanguage: (language: MonacoLanguage) => void,
 *   getCurrentTheme: () => string,
 *   getEditor: () => typeof monaco.editor,
 *   getEditorView: () => monaco.editor.IStandaloneCodeEditor | null,
 *   getDiffEditorView: () => monaco.editor.IStandaloneDiffEditor | null,
 *   getDiffModels: () => { original: monaco.editor.ITextModel | null, modified: monaco.editor.ITextModel | null },
 * }} 返回对象包含以下方法和属性：
 *
 * @property {Function} createEditor - 创建并挂载 Monaco 编辑器到指定容器
 * @property {Function} cleanupEditor - 销毁编辑器并清理容器
 * @property {Function} updateCode - 更新编辑器内容和语言，必要时滚动到底部
 * @property {Function} appendCode - 在编辑器末尾追加文本，必要时滚动到底部
 * @property {Function} createDiffEditor - 创建并挂载 Diff 编辑器
 * @property {Function} updateDiff - 更新 Diff 编辑器的 original/modified 内容（RAF 合并、增量更新）
 * @property {Function} updateOriginal - 仅更新 Diff 的 original 内容（增量更新）
 * @property {Function} updateModified - 仅更新 Diff 的 modified 内容（增量更新）
 * @property {Function} appendOriginal - 在 Diff 的 original 末尾追加（显式流式场景）
 * @property {Function} appendModified - 在 Diff 的 modified 末尾追加（显式流式场景）
 * @property {Function} setTheme - 切换编辑器主题
 * @property {Function} setLanguage - 切换编辑器语言
 * @property {Function} getCurrentTheme - 获取当前主题名称
 * @property {Function} getEditor - 获取 Monaco 的静态 editor 对象（用于静态方法调用）
 * @property {Function} getEditorView - 获取当前编辑器实例
 * @property {Function} getDiffEditorView - 获取当前 Diff 编辑器实例
 * @property {Function} getDiffModels - 获取 Diff 的 original/modified 两个模型
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
function useMonaco(monacoOptions: MonacoOptions = {}) {
  // 清除之前在 onBeforeCreate 中注册的资源
  if (monacoOptions.isCleanOnBeforeCreate ?? true)
    disposals.forEach(d => d.dispose())
  // 释放已处理的引用，避免数组无限增长
  if (monacoOptions.isCleanOnBeforeCreate ?? true)
    disposals.length = 0
  let editorView: monaco.editor.IStandaloneCodeEditor | null = null
  // 新增：Diff Editor 相关引用
  let diffEditorView: monaco.editor.IStandaloneDiffEditor | null = null
  let originalModel: monaco.editor.ITextModel | null = null
  let modifiedModel: monaco.editor.ITextModel | null = null
  // Diff 增量与 RAF 合并所需状态
  let lastKnownOriginalCode: string | null = null
  let lastKnownModifiedCode: string | null = null
  let pendingDiffUpdate:
    | { original: string, modified: string, lang?: string }
    | null = null
  let rafDiffId: number | null = null

  const themes = monacoOptions.themes ?? defaultThemes
  if (!Array.isArray(themes) || themes.length < 2) {
    throw new Error(
      'Monaco themes must be an array with at least two themes: [darkTheme, lightTheme]',
    )
  }
  const languages = monacoOptions.languages ?? defaultLanguages
  const MAX_HEIGHT = monacoOptions.MAX_HEIGHT ?? 500
  const autoScrollOnUpdate = monacoOptions.autoScrollOnUpdate ?? true
  const autoScrollInitial = monacoOptions.autoScrollInitial ?? true
  const autoScrollThresholdPx = monacoOptions.autoScrollThresholdPx ?? 32
  const autoScrollThresholdLines = monacoOptions.autoScrollThresholdLines ?? 2
  const diffAutoScroll = monacoOptions.diffAutoScroll ?? true

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
  let pendingUpdate: { code: string, lang: string } | null = null
  let rafId: number | null = null
  // 自动滚动控制：
  // - 当用户向上滚动离开底部时，暂停 revealLine 的自动滚动
  // - 当用户再次滚动回接近底部（阈值：两行高或 32px）时，恢复自动滚动
  let shouldAutoScroll = true
  let scrollWatcher: monaco.IDisposable | null = null
  let lastScrollTop = 0
  // Diff 自动滚动控制（针对 modified 编辑器）
  let shouldAutoScrollDiff = true
  let diffScrollWatcher: monaco.IDisposable | null = null
  let lastScrollTopDiff = 0
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

  // 检查是否出现垂直滚动条
  function hasVerticalScrollbar(): boolean {
    try {
      if (!editorView)
        return false
      const li = editorView.getLayoutInfo?.()
      const sh = editorView.getScrollHeight?.()
      return !!(li && typeof sh === 'number' && sh > li.height + 1)
    }
    catch {
      return false
    }
  }

  // 判断是否接近底部（阈值：两行高度或 32px）
  function userIsNearBottom(): boolean {
    try {
      if (!editorView)
        return true
      const li = editorView.getLayoutInfo?.()
      if (!li)
        return true
      const lineHeight = editorView.getOption(
        monaco.editor.EditorOption.lineHeight,
      )
      const lineThreshold = (autoScrollThresholdLines ?? 0) * lineHeight
      const threshold = Math.max(lineThreshold || 0, autoScrollThresholdPx || 0)
      const st = editorView.getScrollTop?.() ?? 0
      const sh = editorView.getScrollHeight?.() ?? li.height
      const distance = sh - (st + li.height)
      return distance <= threshold
    }
    catch {
      return true
    }
  }

  // Diff: 检查 modified 编辑器是否出现垂直滚动条
  function hasVerticalScrollbarModified(): boolean {
    try {
      if (!diffEditorView)
        return false
      const me = diffEditorView.getModifiedEditor()
      const li = me.getLayoutInfo?.()
      const sh = me.getScrollHeight?.()
      return !!(li && typeof sh === 'number' && sh > li.height + 1)
    }
    catch {
      return false
    }
  }

  // Diff: 判断 modified 是否接近底部
  function userIsNearBottomDiff(): boolean {
    try {
      if (!diffEditorView)
        return true
      const me = diffEditorView.getModifiedEditor()
      const li = me.getLayoutInfo?.()
      if (!li)
        return true
      const lineHeight = me.getOption(monaco.editor.EditorOption.lineHeight)
      const lineThreshold = (autoScrollThresholdLines ?? 0) * lineHeight
      const threshold = Math.max(lineThreshold || 0, autoScrollThresholdPx || 0)
      const st = me.getScrollTop?.() ?? 0
      const sh = me.getScrollHeight?.() ?? li.height
      const distance = sh - (st + li.height)
      return distance <= threshold
    }
    catch {
      return true
    }
  }

  // Diff: 在满足条件时滚动 modified 底部
  function maybeScrollDiffToBottom(targetLine?: number) {
    if (!diffEditorView)
      return
    if (diffAutoScroll && autoScrollOnUpdate && shouldAutoScrollDiff && hasVerticalScrollbarModified()) {
      const me = diffEditorView.getModifiedEditor()
      const model = me.getModel()
      const line = targetLine ?? model?.getLineCount() ?? 1
      me.revealLine(line)
    }
  }

  // 在满足条件时滚动到底部，否则尊重用户滚动状态
  function maybeScrollToBottom(targetLine?: number) {
    if (!editorView)
      return
    if (autoScrollOnUpdate && shouldAutoScroll && hasVerticalScrollbar()) {
      const model = editorView.getModel()
      const line = targetLine ?? model?.getLineCount() ?? 1
      editorView.revealLine(line)
    }
  }

  async function createEditor(
    container: HTMLElement,
    code: string,
    language: string,
  ) {
    cleanupEditor()
    lastContainer = container

    // 在创建编辑器之前执行用户自定义逻辑（按需清理上一次的 disposables）
    if (monacoOptions.isCleanOnBeforeCreate ?? true) {
      disposals.forEach(d => d.dispose())
      disposals.length = 0
    }
    if (monacoOptions.onBeforeCreate) {
      const ds = monacoOptions.onBeforeCreate(monaco)
      if (ds)
        disposals.push(...ds)
    }

    // Stop any previous watcher
    if (themeWatcher) {
      themeWatcher()
      themeWatcher = null
    }

    // Register themes and languages
    themeRegisterPromise = registerMonacoThemes(themes, languages)
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
      }
      catch {
        // ignore
      }
    })

    // 初始化并监听滚动：根据配置默认启用/禁用自动滚动；
    // 用户向上滚动则立即暂停，向下滚动并接近底部时恢复
    shouldAutoScroll = !!autoScrollInitial
    lastScrollTop = editorView.getScrollTop?.() ?? 0
    if (scrollWatcher) {
      try {
        scrollWatcher.dispose()
      }
      catch {}
      scrollWatcher = null
    }
    scrollWatcher
      = editorView.onDidScrollChange?.((e) => {
        const currentTop
          = e && typeof e.scrollTop === 'number'
            ? e.scrollTop
            : editorView!.getScrollTop?.() ?? 0
        const delta = currentTop - lastScrollTop
        lastScrollTop = currentTop
        if (delta < 0) {
          // 用户向上滚动：立即暂停自动滚动
          shouldAutoScroll = false
          return
        }
        // 向下或未变化：仅当接近底部时恢复
        shouldAutoScroll = userIsNearBottom()
      }) ?? null

    // Scroll to the bottom if initialized with a scrollbar
    const model = editorView.getModel()
    const lineCount = model?.getLineCount() ?? 1
    maybeScrollToBottom(lineCount)

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

  // 新增：创建 Diff 编辑器
  async function createDiffEditor(
    container: HTMLElement,
    originalCode: string,
    modifiedCode: string,
    language: string,
  ) {
    cleanupEditor()
    lastContainer = container

    // 在创建编辑器之前执行用户自定义逻辑（按需清理上一次的 disposables）
    if (monacoOptions.isCleanOnBeforeCreate ?? true) {
      disposals.forEach(d => d.dispose())
      disposals.length = 0
    }
    if (monacoOptions.onBeforeCreate) {
      const ds = monacoOptions.onBeforeCreate(monaco)
      if (ds)
        disposals.push(...ds)
    }

    if (themeWatcher) {
      themeWatcher()
      themeWatcher = null
    }

    themeRegisterPromise = registerMonacoThemes(themes, languages)
    await themeRegisterPromise

    container.style.overflow = 'auto'
    container.style.maxHeight = maxHeightCSS

    const lang = processedLanguage(language) || language

    // 创建模型
    originalModel = monaco.editor.createModel(originalCode, lang)
    modifiedModel = monaco.editor.createModel(modifiedCode, lang)

    // 创建 Diff Editor
    diffEditorView = monaco.editor.createDiffEditor(container, {
      automaticLayout: true,
      scrollBeyondLastLine: false,
      renderSideBySide: true,
      originalEditable: false,
      readOnly: monacoOptions.readOnly ?? true,
      minimap: { enabled: false },
      theme: currentTheme.value,
      contextmenu: false,
      scrollbar: {
        ...defaultScrollbar,
        ...(monacoOptions.scrollbar || {}),
      },
      ...monacoOptions,
    })

    diffEditorView.setModel({
      original: originalModel,
      modified: modifiedModel,
    })

    // 初始化 lastKnown（供增量判断）
    lastKnownOriginalCode = originalCode
    lastKnownModifiedCode = modifiedCode

    // 初始化并监听 modified 滚动（与单编辑器一致的暂停/恢复逻辑）
    shouldAutoScrollDiff = !!(autoScrollInitial && diffAutoScroll)
    const me = diffEditorView.getModifiedEditor()
    lastScrollTopDiff = me.getScrollTop?.() ?? 0
    if (diffScrollWatcher) {
      try {
        diffScrollWatcher.dispose()
      }
      catch {}
      diffScrollWatcher = null
    }
    if (diffAutoScroll) {
      diffScrollWatcher
        = me.onDidScrollChange?.((e) => {
          const currentTop
            = e && typeof e.scrollTop === 'number'
              ? e.scrollTop
              : me.getScrollTop?.() ?? 0
          const delta = currentTop - lastScrollTopDiff
          lastScrollTopDiff = currentTop
          if (delta < 0) {
            // 用户向上滚动：立即暂停自动滚动
            shouldAutoScrollDiff = false
            return
          }
          // 向下或未变化：仅当接近底部时恢复
          shouldAutoScrollDiff = userIsNearBottomDiff()
        }) ?? null
    }

    // 初始化时尝试滚动到 modified 底部
    maybeScrollDiffToBottom(modifiedModel.getLineCount())

    // 高度自适应：取原/新两侧的最大行数
    const padding = 16
    function updateHeight() {
      const modifiedEditor = diffEditorView!.getModifiedEditor()
      const originalEditor = diffEditorView!.getOriginalEditor()
      const lineHeight = modifiedEditor.getOption(
        monaco.editor.EditorOption.lineHeight,
      )

      const oCount = originalEditor.getModel()?.getLineCount() ?? 1
      const mCount = modifiedEditor.getModel()?.getLineCount() ?? 1
      const lineCount = Math.max(oCount, mCount)

      const height = Math.min(lineCount * lineHeight + padding, maxHeightValue)
      container.style.height = `${height}px`
    }

    // 初始化高度
    updateHeight()

    // 监听内容与尺寸变化
    const oEditor = diffEditorView.getOriginalEditor()
    const mEditor = diffEditorView.getModifiedEditor()
    oEditor.onDidContentSizeChange?.(() => updateHeight())
    mEditor.onDidContentSizeChange?.(() => updateHeight())
    oEditor.onDidChangeModelContent?.(() => updateHeight())
    mEditor.onDidChangeModelContent?.(() => updateHeight())

    // 主题监听
    themeWatcher = watch(
      () => isDark.value,
      () => {
        if (currentTheme.value !== lastAppliedTheme) {
          monaco.editor.setTheme(currentTheme.value)
          lastAppliedTheme = currentTheme.value
        }
      },
      { flush: 'post', immediate: true },
    )

    return diffEditorView
  }

  onUnmounted(cleanupEditor)

  // Ensure cleanup stops the watcher
  function cleanupEditor() {
    if (rafId != null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    pendingUpdate = null
    if (rafDiffId != null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafDiffId)
      rafDiffId = null
    }
    pendingDiffUpdate = null
    if (editorView) {
      editorView.dispose()
      editorView = null
    }
    lastKnownCode = null
    lastKnownOriginalCode = null
    lastKnownModifiedCode = null
    if (lastContainer) {
      lastContainer.innerHTML = ''
      lastContainer = null
    }
    if (themeWatcher) {
      themeWatcher()
      themeWatcher = null
    }
    if (scrollWatcher) {
      try {
        scrollWatcher.dispose()
      }
      catch {}
      scrollWatcher = null
    }
    if (diffScrollWatcher) {
      try {
        diffScrollWatcher.dispose()
      }
      catch {}
      diffScrollWatcher = null
    }

    // 新增：释放 Diff 相关资源
    if (diffEditorView) {
      try {
        diffEditorView.dispose()
      }
      catch {}
      diffEditorView = null
    }
    if (originalModel) {
      try {
        originalModel.dispose()
      }
      catch {}
      originalModel = null
    }
    if (modifiedModel) {
      try {
        modifiedModel.dispose()
      }
      catch {}
      modifiedModel = null
    }
  }

  // 将 updateCode 和 appendCode 提升为闭包内函数，便于相互调用且避免 this 绑定问题
  function appendCode(appendText: string, codeLanguage?: string) {
    if (!editorView)
      return
    const model = editorView.getModel()
    if (!model)
      return

    const processedCodeLanguage = codeLanguage
      ? processedLanguage(codeLanguage)
      : model.getLanguageId()
    if (
      processedCodeLanguage
      && model.getLanguageId() !== processedCodeLanguage
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
    }
    else {
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
    }
    catch {
      // ignore
    }

    // 如果出现滚动条且允许自动滚动则滚动到底部
    const newLine = model.getLineCount()
    maybeScrollToBottom(newLine)
  }

  // 计算前后缀公共部分，并构造最小替换编辑（中间段替换）
  function applyMinimalEdit(prev: string, next: string) {
    if (!editorView)
      return
    const model = editorView.getModel()
    if (!model)
      return

    // 完全相同无需处理
    const res = computeMinimalEdit(prev, next)
    if (!res)
      return
    const { start, endPrevIncl, replaceText } = res
    const rangeStart = model.getPositionAt(start)
    const rangeEnd = model.getPositionAt(endPrevIncl + 1)
    const range = new monaco.Range(
      rangeStart.lineNumber,
      rangeStart.column,
      rangeEnd.lineNumber,
      rangeEnd.column,
    )

    const isReadOnly = editorView.getOption(monaco.editor.EditorOption.readOnly)
    const edit = [{ range, text: replaceText, forceMoveMarkers: true }]
    if (isReadOnly)
      model.applyEdits(edit)
    else editorView.executeEdits('minimal-replace', edit)
  }

  // 对任意模型执行最小替换（用于 Diff 两侧的模型）
  function applyMinimalEditToModel(
    model: monaco.editor.ITextModel,
    prev: string,
    next: string,
  ) {
    const res = computeMinimalEdit(prev, next)
    if (!res)
      return
    const { start, endPrevIncl, replaceText } = res
    const rangeStart = model.getPositionAt(start)
    const rangeEnd = model.getPositionAt(endPrevIncl + 1)
    const range = new monaco.Range(
      rangeStart.lineNumber,
      rangeStart.column,
      rangeEnd.lineNumber,
      rangeEnd.column,
    )
    model.applyEdits([{ range, text: replaceText, forceMoveMarkers: true }])
  }

  // 向模型尾部追加文本
  function appendToModel(model: monaco.editor.ITextModel, appendText: string) {
    if (!appendText)
      return
    const lastLine = model.getLineCount()
    const lastColumn = model.getLineMaxColumn(lastLine)
    const range = new monaco.Range(lastLine, lastColumn, lastLine, lastColumn)
    model.applyEdits([{ range, text: appendText, forceMoveMarkers: true }])
  }

  function flushPendingUpdate() {
    rafId = null
    if (!pendingUpdate)
      return
    if (!editorView)
      return
    const model = editorView.getModel()
    if (!model)
      return
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
      if (newLineCount !== prevLineCount) {
        maybeScrollToBottom(newLineCount)
      }
      return
    }

    const prevCode = lastKnownCode ?? editorView.getValue()
    if (prevCode === newCode)
      return

    // 仅追加（流式场景最常见）
    if (newCode.startsWith(prevCode) && prevCode.length < newCode.length) {
      const suffix = newCode.slice(prevCode.length)
      if (suffix)
        appendCode(suffix, codeLanguage)
      lastKnownCode = newCode
      return
    }

    // 中间最小替换，减少 DOM 变动范围
    const prevLineCount = model.getLineCount()
    applyMinimalEdit(prevCode, newCode)
    lastKnownCode = newCode
    const newLineCount = model.getLineCount()
    if (newLineCount !== prevLineCount) {
      maybeScrollToBottom(newLineCount)
    }
  }

  function updateCode(newCode: string, codeLanguage: string) {
    // 合并本帧内的多次调用
    pendingUpdate = { code: newCode, lang: codeLanguage }
    if (rafId != null)
      cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(flushPendingUpdate)
  }

  // Diff：RAF 合并与增量刷新
  function flushPendingDiffUpdate() {
    rafDiffId = null
    if (!pendingDiffUpdate)
      return
    if (!diffEditorView)
      return
    const o = originalModel
    const m = modifiedModel
    if (!o || !m) {
      pendingDiffUpdate = null
      return
    }

    const { original, modified, lang } = pendingDiffUpdate
    pendingDiffUpdate = null

    if (lang) {
      const plang = processedLanguage(lang)
      if (plang) {
        if (o.getLanguageId() !== plang)
          monaco.editor.setModelLanguage(o, plang)
        if (m.getLanguageId() !== plang)
          monaco.editor.setModelLanguage(m, plang)
      }
    }

    if (lastKnownOriginalCode == null)
      lastKnownOriginalCode = o.getValue()
    if (lastKnownModifiedCode == null)
      lastKnownModifiedCode = m.getValue()

    const prevO = lastKnownOriginalCode!
    if (prevO !== original) {
      if (original.startsWith(prevO) && prevO.length < original.length) {
        appendToModel(o, original.slice(prevO.length))
      }
      else {
        applyMinimalEditToModel(o, prevO, original)
      }
      lastKnownOriginalCode = original
    }

    const prevM = lastKnownModifiedCode!
    const prevMLineCount = m.getLineCount()
    if (prevM !== modified) {
      if (modified.startsWith(prevM) && prevM.length < modified.length) {
        appendToModel(m, modified.slice(prevM.length))
      }
      else {
        applyMinimalEditToModel(m, prevM, modified)
      }
      lastKnownModifiedCode = modified
      const newMLineCount = m.getLineCount()
      if (newMLineCount !== prevMLineCount) {
        maybeScrollDiffToBottom(newMLineCount)
      }
    }
  }

  // 更新 Diff（合并同帧，增量写入）
  function updateDiff(
    originalCode: string,
    modifiedCode: string,
    codeLanguage?: string,
  ) {
    if (!diffEditorView)
      return
    const o = originalModel
    const m = modifiedModel
    if (!o || !m)
      return

    // 如果指定了语言且与当前模型语言不一致，走 RAF + 全量/最小替换路径
    const plang = codeLanguage ? processedLanguage(codeLanguage) : undefined
    if (
      plang
      && (o.getLanguageId() !== plang || m.getLanguageId() !== plang)
    ) {
      pendingDiffUpdate = {
        original: originalCode,
        modified: modifiedCode,
        lang: codeLanguage,
      }
      if (rafDiffId != null)
        cancelAnimationFrame(rafDiffId)
      rafDiffId = requestAnimationFrame(flushPendingDiffUpdate)
      return
    }

    // 初始化 lastKnown 值（不触发读取后被覆盖的问题）
    if (lastKnownOriginalCode == null)
      lastKnownOriginalCode = o.getValue()
    if (lastKnownModifiedCode == null)
      lastKnownModifiedCode = m.getValue()

    const prevO = lastKnownOriginalCode!
    const prevM = lastKnownModifiedCode!
    let didImmediate = false

    // 原文仅末尾追加：立即落地
    if (originalCode !== prevO && originalCode.startsWith(prevO)) {
      appendToModel(o, originalCode.slice(prevO.length))
      lastKnownOriginalCode = originalCode
      didImmediate = true
    }

    // 新文仅末尾追加：立即落地
    if (modifiedCode !== prevM && modifiedCode.startsWith(prevM)) {
      appendToModel(m, modifiedCode.slice(prevM.length))
      lastKnownModifiedCode = modifiedCode
      didImmediate = true
      // 追加时尝试滚动到底部
      maybeScrollDiffToBottom(m.getLineCount())
    }

    // 若仍有非追加的变化，走 RAF 最小替换；否则如果做了立即追加则到此结束
    if (
      originalCode !== lastKnownOriginalCode
      || modifiedCode !== lastKnownModifiedCode
    ) {
      pendingDiffUpdate = {
        original: originalCode,
        modified: modifiedCode,
        // 语言相同，这里不传 lang 触发纯内容路径
      }
      if (rafDiffId != null)
        cancelAnimationFrame(rafDiffId)
      rafDiffId = requestAnimationFrame(flushPendingDiffUpdate)
    }
    else if (didImmediate) {
      // 已即时追加，无需 RAF

    }
  }

  // 分别更新 original/modified（即时增量）
  function updateOriginal(newCode: string, codeLanguage?: string) {
    if (!diffEditorView || !originalModel)
      return
    if (codeLanguage) {
      const lang = processedLanguage(codeLanguage)
      if (lang && originalModel.getLanguageId() !== lang)
        monaco.editor.setModelLanguage(originalModel, lang)
    }
    const prev = lastKnownOriginalCode ?? originalModel.getValue()
    if (prev === newCode)
      return
    if (newCode.startsWith(prev) && prev.length < newCode.length) {
      appendToModel(originalModel, newCode.slice(prev.length))
    }
    else {
      applyMinimalEditToModel(originalModel, prev, newCode)
    }
    lastKnownOriginalCode = newCode
  }

  function updateModified(newCode: string, codeLanguage?: string) {
    if (!diffEditorView || !modifiedModel)
      return
    if (codeLanguage) {
      const lang = processedLanguage(codeLanguage)
      if (lang && modifiedModel.getLanguageId() !== lang)
        monaco.editor.setModelLanguage(modifiedModel, lang)
    }
    const prev = lastKnownModifiedCode ?? modifiedModel.getValue()
    if (prev === newCode)
      return
    if (newCode.startsWith(prev) && prev.length < newCode.length) {
      appendToModel(modifiedModel, newCode.slice(prev.length))
      maybeScrollDiffToBottom(modifiedModel.getLineCount())
    }
    else {
      applyMinimalEditToModel(modifiedModel, prev, newCode)
    }
    lastKnownModifiedCode = newCode
  }

  // 显式在 Diff 的 original 末尾追加
  function appendOriginal(appendText: string, codeLanguage?: string) {
    if (!diffEditorView || !originalModel || !appendText)
      return
    if (codeLanguage) {
      const lang = processedLanguage(codeLanguage)
      if (lang && originalModel.getLanguageId() !== lang)
        monaco.editor.setModelLanguage(originalModel, lang)
    }
    appendToModel(originalModel, appendText)
    try {
      lastKnownOriginalCode = originalModel.getValue()
    }
    catch {}
  }

  // 显式在 Diff 的 modified 末尾追加，并在需要时滚动
  function appendModified(appendText: string, codeLanguage?: string) {
    if (!diffEditorView || !modifiedModel || !appendText)
      return
    if (codeLanguage) {
      const lang = processedLanguage(codeLanguage)
      if (lang && modifiedModel.getLanguageId() !== lang)
        monaco.editor.setModelLanguage(modifiedModel, lang)
    }
    appendToModel(modifiedModel, appendText)
    try {
      lastKnownModifiedCode = modifiedModel.getValue()
    }
    catch {}
    maybeScrollDiffToBottom(modifiedModel.getLineCount())
  }

  return {
    createEditor,
    // 新增导出：Diff
    createDiffEditor,
    cleanupEditor,
    updateCode,
    appendCode,
    // 新增导出：Diff 更新与访问
    updateDiff,
    updateOriginal,
    updateModified,
    appendOriginal,
    appendModified,
    setTheme(theme: MonacoTheme) {
      if (themes.includes(theme)) {
        monaco.editor.setTheme(
          typeof theme === 'string' ? theme : (theme as any).name,
        )
      }
      else {
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
      }
      else {
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
    // 新增导出：获取 Diff Editor
    getDiffEditorView() {
      return diffEditorView
    },
    // 新增导出：获取 Diff 两侧模型
    getDiffModels() {
      return { original: originalModel, modified: modifiedModel }
    },
  }
}

export { detectLanguage, preloadMonacoWorkers, useMonaco }

export * from './type'
