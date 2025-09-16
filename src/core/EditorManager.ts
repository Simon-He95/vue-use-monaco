import type { MonacoLanguage, MonacoOptions } from '../type'
import * as monaco from 'monaco-editor'
import { processedLanguage } from '../code.detect'
import { defaultScrollbar, padding } from '../constant'
import { computeMinimalEdit } from '../minimalEdit'
import { createHeightManager } from '../utils/height'
import { createRafScheduler } from '../utils/raf'
import { createScrollWatcherForEditor } from '../utils/scroll'

export class EditorManager {
  private editorView: monaco.editor.IStandaloneCodeEditor | null = null
  private lastContainer: HTMLElement | null = null
  private lastKnownCode: string | null = null
  private pendingUpdate: { code: string, lang: string } | null = null
  private _hasScrollBar = false

  private shouldAutoScroll = true
  private scrollWatcher: monaco.IDisposable | null = null
  private lastScrollTop = 0

  private cachedScrollHeight: number | null = null
  private cachedLineHeight: number | null = null
  private cachedComputedHeight: number | null = null

  private appendBuffer: string[] = []
  private appendBufferScheduled = false

  private rafScheduler = createRafScheduler()
  private editorHeightManager: ReturnType<typeof createHeightManager> | null = null

  constructor(
    private options: MonacoOptions,
    private maxHeightValue: number,
    private maxHeightCSS: string,
    private autoScrollOnUpdate: boolean,
    private autoScrollInitial: boolean,
    private autoScrollThresholdPx: number,
    private autoScrollThresholdLines: number,
  ) {}

  private hasVerticalScrollbar(): boolean {
    try {
      if (!this.editorView)
        return false
      if (this._hasScrollBar)
        return true
      const ch = this.cachedComputedHeight ?? this.computedHeight(this.editorView)
      return this._hasScrollBar = (this.editorView.getScrollHeight!() > ch + padding / 2)
    }
    catch {
      return false
    }
  }

  private userIsNearBottom(): boolean {
    try {
      if (!this.editorView)
        return true
      const li = this.editorView.getLayoutInfo?.()
      if (!li)
        return true
      const lineHeight = this.cachedLineHeight ?? this.editorView.getOption(
        monaco.editor.EditorOption.lineHeight,
      )
      const lineThreshold = (this.autoScrollThresholdLines ?? 0) * lineHeight
      const threshold = Math.max(lineThreshold || 0, this.autoScrollThresholdPx || 0)
      const st = this.editorView.getScrollTop?.() ?? 0
      const sh = this.cachedScrollHeight ?? this.editorView.getScrollHeight?.() ?? li.height
      const distance = sh - (st + li.height)
      return distance <= threshold
    }
    catch {
      return true
    }
  }

  private computedHeight(editorView: monaco.editor.IStandaloneCodeEditor) {
    const lineCount = editorView.getModel()?.getLineCount() ?? 1
    const lineHeight = editorView.getOption(monaco.editor.EditorOption.lineHeight)
    const height = Math.min(lineCount * lineHeight + padding, this.maxHeightValue)
    return height
  }

  private maybeScrollToBottom(targetLine?: number) {
    if (this.autoScrollOnUpdate && this.shouldAutoScroll && this.hasVerticalScrollbar()) {
      const model = this.editorView!.getModel()
      const line = targetLine ?? model?.getLineCount() ?? 1
      this.rafScheduler.schedule('reveal', () => {
        try {
          this.editorView!.revealLine(line)
        }
        catch { }
      })
    }
  }

  async createEditor(
    container: HTMLElement,
    code: string,
    language: string,
    currentTheme: string,
  ) {
    this.cleanup()
    this.lastContainer = container

    container.style.overflow = 'auto'
    container.style.maxHeight = this.maxHeightCSS

    this.editorView = monaco.editor.create(container, {
      value: code,
      language: processedLanguage(language) || language,
      theme: currentTheme,
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      automaticLayout: true,
      readOnly: this.options.readOnly ?? true,
      contextmenu: false,
      scrollbar: {
        ...defaultScrollbar,
        ...(this.options.scrollbar || {}),
      },
      ...this.options,
    })

    this.lastKnownCode = this.editorView.getValue()

    if (this.editorHeightManager) {
      try {
        this.editorHeightManager.dispose()
      }
      catch { }
      this.editorHeightManager = null
    }
    this.editorHeightManager = createHeightManager(container, () => this.computedHeight(this.editorView!))
    this.editorHeightManager.update()

    try {
      this.cachedScrollHeight = this.editorView.getScrollHeight?.() ?? null
      this.cachedLineHeight = this.editorView.getOption?.(monaco.editor.EditorOption.lineHeight) ?? null
      this.cachedComputedHeight = this.computedHeight(this.editorView)
    }
    catch { }

    this.editorView.onDidContentSizeChange?.(() => {
      this._hasScrollBar = false
      try {
        this.cachedScrollHeight = this.editorView!.getScrollHeight?.() ?? null
        this.cachedLineHeight = this.editorView!.getOption?.(monaco.editor.EditorOption.lineHeight) ?? null
        this.cachedComputedHeight = this.computedHeight(this.editorView!)
      }
      catch { }
      if (this.editorHeightManager?.isSuppressed())
        return
      this.editorHeightManager?.update()
    })

    this.editorView.onDidChangeModelContent(() => {
      try {
        this.lastKnownCode = this.editorView!.getValue()
      }
      catch { }
    })

    this.shouldAutoScroll = !!this.autoScrollInitial
    if (this.scrollWatcher) {
      try {
        this.scrollWatcher.dispose()
      }
      catch { }
      this.scrollWatcher = null
    }
    this.scrollWatcher = createScrollWatcherForEditor(this.editorView, {
      onPause: () => { this.shouldAutoScroll = false },
      onMaybeResume: () => { this.shouldAutoScroll = this.userIsNearBottom() },
      getLast: () => this.lastScrollTop,
      setLast: (v: number) => { this.lastScrollTop = v },
    })

    this.maybeScrollToBottom()

    return this.editorView
  }

  updateCode(newCode: string, codeLanguage: string) {
    this.pendingUpdate = { code: newCode, lang: codeLanguage }
    this.rafScheduler.schedule('update', () => this.flushPendingUpdate())
  }

  private flushPendingUpdate() {
    if (!this.pendingUpdate || !this.editorView)
      return
    const model = this.editorView.getModel()
    if (!model)
      return

    const { code: newCode, lang: codeLanguage } = this.pendingUpdate
    this.pendingUpdate = null
    const processedCodeLanguage = processedLanguage(codeLanguage)
    const languageId = model.getLanguageId()

    if (languageId !== processedCodeLanguage) {
      if (processedCodeLanguage)
        monaco.editor.setModelLanguage(model, processedCodeLanguage)
      const prevLineCount = model.getLineCount()
      model.setValue(newCode)
      this.lastKnownCode = newCode
      const newLineCount = model.getLineCount()
      if (newLineCount !== prevLineCount) {
        this.maybeScrollToBottom(newLineCount)
      }
      return
    }

    const prevCode = this.lastKnownCode ?? this.editorView.getValue()
    if (prevCode === newCode)
      return

    if (newCode.startsWith(prevCode) && prevCode.length < newCode.length) {
      const suffix = newCode.slice(prevCode.length)
      if (suffix)
        this.appendCode(suffix, codeLanguage)
      this.lastKnownCode = newCode
      return
    }

    const prevLineCount = model.getLineCount()
    this.applyMinimalEdit(prevCode, newCode)
    this.lastKnownCode = newCode
    const newLineCount = model.getLineCount()
    if (newLineCount !== prevLineCount) {
      this.maybeScrollToBottom(newLineCount)
    }
  }

  appendCode(appendText: string, codeLanguage?: string) {
    if (!this.editorView)
      return
    const model = this.editorView.getModel()
    if (!model)
      return

    const processedCodeLanguage = codeLanguage ? processedLanguage(codeLanguage) : model.getLanguageId()
    if (processedCodeLanguage && model.getLanguageId() !== processedCodeLanguage)
      monaco.editor.setModelLanguage(model, processedCodeLanguage)

    const lastLine = model.getLineCount()
    const lastColumn = model.getLineMaxColumn(lastLine)
    const range = new monaco.Range(lastLine, lastColumn, lastLine, lastColumn)

    const isReadOnly = this.editorView.getOption(monaco.editor.EditorOption.readOnly)
    if (isReadOnly) {
      model.applyEdits([{ range, text: appendText, forceMoveMarkers: true }])
    }
    else {
      this.editorView.executeEdits('append', [{ range, text: appendText, forceMoveMarkers: true }])
    }

    try {
      this.lastKnownCode = model.getValue()
    }
    catch { }

    if (appendText) {
      this.appendBuffer.push(appendText)
      if (!this.appendBufferScheduled) {
        this.appendBufferScheduled = true
        this.rafScheduler.schedule('append', () => this.flushAppendBuffer())
      }
    }
  }

  private applyMinimalEdit(prev: string, next: string) {
    if (!this.editorView)
      return
    const model = this.editorView.getModel()
    if (!model)
      return

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

    const isReadOnly = this.editorView.getOption(monaco.editor.EditorOption.readOnly)
    const edit = [{ range, text: replaceText, forceMoveMarkers: true }]
    if (isReadOnly)
      model.applyEdits(edit)
    else this.editorView.executeEdits('minimal-replace', edit)
  }

  private flushAppendBuffer() {
    if (!this.editorView)
      return
    if (this.appendBuffer.length === 0)
      return
    this.appendBufferScheduled = false
    const model = this.editorView.getModel()
    if (!model) {
      this.appendBuffer.length = 0
      return
    }
    const text = this.appendBuffer.join('')
    this.appendBuffer.length = 0
    try {
      const lastLine = model.getLineCount()
      const lastColumn = model.getLineMaxColumn(lastLine)
      const range = new monaco.Range(lastLine, lastColumn, lastLine, lastColumn)
      const isReadOnly = this.editorView.getOption(monaco.editor.EditorOption.readOnly)
      if (isReadOnly) {
        model.applyEdits([{ range, text, forceMoveMarkers: true }])
      }
      else {
        this.editorView.executeEdits('append', [{ range, text, forceMoveMarkers: true }])
      }
      if (this.lastKnownCode != null) {
        this.lastKnownCode = this.lastKnownCode + text
      }
      try {
        this.maybeScrollToBottom(model.getLineCount())
      }
      catch { }
    }
    catch { }
  }

  setLanguage(language: MonacoLanguage, languages: MonacoLanguage[]) {
    if (languages.includes(language)) {
      if (this.editorView) {
        const model = this.editorView.getModel()
        if (model && model.getLanguageId() !== language)
          monaco.editor.setModelLanguage(model, language)
      }
    }
    else {
      console.warn(`Language "${language}" is not registered. Available languages: ${languages.join(', ')}`)
    }
  }

  getEditorView() {
    return this.editorView
  }

  cleanup() {
    this.rafScheduler.cancel('update')
    this.pendingUpdate = null
    this.rafScheduler.cancel('append')
    this.appendBufferScheduled = false
    this.appendBuffer.length = 0

    if (this.editorView) {
      this.editorView.dispose()
      this.editorView = null
    }
    this.lastKnownCode = null
    if (this.lastContainer) {
      this.lastContainer.innerHTML = ''
      this.lastContainer = null
    }
    if (this.scrollWatcher) {
      try {
        this.scrollWatcher.dispose()
      }
      catch { }
      this.scrollWatcher = null
    }
    if (this.editorHeightManager) {
      try {
        this.editorHeightManager.dispose()
      }
      catch { }
      this.editorHeightManager = null
    }
  }

  safeClean() {
    this.rafScheduler.cancel('update')
    this.pendingUpdate = null

    if (this.scrollWatcher) {
      try {
        this.scrollWatcher.dispose()
      }
      catch { }
      this.scrollWatcher = null
    }

    this._hasScrollBar = false
    this.shouldAutoScroll = !!this.autoScrollInitial
    this.lastScrollTop = 0

    if (this.editorHeightManager) {
      try {
        this.editorHeightManager.dispose()
      }
      catch { }
      this.editorHeightManager = null
    }
  }
}
