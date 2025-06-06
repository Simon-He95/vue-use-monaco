import type { SpecialTheme, ThemeInput } from 'shiki'
import { shikiToMonaco } from '@shikijs/monaco'
import * as monaco from 'monaco-editor'

// @ts-expect-error bundle import for shiki
import { createHighlighter } from 'shiki/bundle/full'
import { computed, onUnmounted } from 'vue'
import { detectLanguage, processedLanguage } from './code.detect'
import { isDark } from './isDark'

export type MonacoEditorInstance = monaco.editor.IStandaloneCodeEditor

let themesRegistered = false
let languagesRegistered = false
let themeRegisterPromise: Promise<void> | null = null
let currentThemes: (ThemeInput | string | SpecialTheme)[] = []
let currentLanguages: string[] = []

async function registerMonacoThemes(themes: (ThemeInput | string | SpecialTheme)[], languages: string[]) {
  registerMonacoLanguages(languages)
  if (
    themesRegistered
    && JSON.stringify(themes) === JSON.stringify(currentThemes)
    && JSON.stringify(languages) === JSON.stringify(currentLanguages)
  ) {
    return
  }
  themesRegistered = true
  currentThemes = themes
  currentLanguages = languages
  const highlighter = await createHighlighter({
    themes,
    langs: languages,
  })
  shikiToMonaco(highlighter, monaco)
}

function registerMonacoLanguages(languages: string[]) {
  if (languagesRegistered && JSON.stringify(languages) === JSON.stringify(currentLanguages))
    return
  languagesRegistered = true
  currentLanguages = languages
  for (const lang of languages) {
    monaco.languages.register({ id: lang })
  }
}

export type MonacoTheme = | 'andromeeda' | 'aurora-x' | 'ayu-dark' | 'catppuccin-frappe' | 'catppuccin-latte' | 'catppuccin-macchiato' | 'catppuccin-mocha' | 'dark-plus' | 'dracula' | 'dracula-soft' | 'everforest-dark' | 'everforest-light' | 'github-dark' | 'github-dark-default' | 'github-dark-dimmed' | 'github-dark-high-contrast' | 'github-light' | 'github-light-default' | 'github-light-high-contrast' | 'gruvbox-dark-hard' | 'gruvbox-dark-medium' | 'gruvbox-dark-soft' | 'gruvbox-light-hard' | 'gruvbox-light-medium' | 'gruvbox-light-soft' | 'houston' | 'kanagawa-dragon' | 'kanagawa-lotus' | 'kanagawa-wave' | 'laserwave' | 'light-plus' | 'material-theme' | 'material-theme-darker' | 'material-theme-lighter' | 'material-theme-ocean' | 'material-theme-palenight' | 'min-dark' | 'min-light' | 'monokai' | 'night-owl' | 'nord' | 'one-dark-pro' | 'one-light' | 'plastic' | 'poimandres' | 'red' | 'rose-pine' | 'rose-pine-dawn' | 'rose-pine-moon' | 'slack-dark' | 'slack-ochin' | 'snazzy-light' | 'solarized-dark' | 'solarized-light' | 'synthwave-84' | 'tokyo-night' | 'vesper' | 'vitesse-black' | 'vitesse-dark' | 'vitesse-light' | ThemeInput | string | SpecialTheme
export type MonacoLanguage = | 'abap' | 'actionscript-3' | 'ada' | 'angular-html' | 'angular-ts' | 'apache' | 'apex' | 'apl' | 'applescript' | 'ara' | 'asciidoc' | 'asm' | 'astro' | 'awk' | 'ballerina' | 'bat' | 'beancount' | 'berry' | 'bibtex' | 'bicep' | 'blade' | 'bsl' | 'c' | 'cadence' | 'cairo' | 'clarity' | 'clojure' | 'cmake' | 'cobol' | 'codeowners' | 'codeql' | 'coffee' | 'common-lisp' | 'coq' | 'cpp' | 'crystal' | 'csharp' | 'css' | 'csv' | 'cue' | 'cypher' | 'd' | 'dart' | 'dax' | 'desktop' | 'diff' | 'docker' | 'dotenv' | 'dream-maker' | 'edge' | 'elixir' | 'elm' | 'emacs-lisp' | 'erb' | 'erlang' | 'fennel' | 'fish' | 'fluent' | 'fortran-fixed-form' | 'fortran-free-form' | 'fsharp' | 'gdresource' | 'gdscript' | 'gdshader' | 'genie' | 'gherkin' | 'git-commit' | 'git-rebase' | 'gleam' | 'glimmer-js' | 'glimmer-ts' | 'glsl' | 'gnuplot' | 'go' | 'graphql' | 'groovy' | 'hack' | 'haml' | 'handlebars' | 'haskell' | 'haxe' | 'hcl' | 'hjson' | 'hlsl' | 'html' | 'html-derivative' | 'http' | 'hxml' | 'hy' | 'imba' | 'ini' | 'java' | 'javascript' | 'jinja' | 'jison' | 'json' | 'json5' | 'jsonc' | 'jsonl' | 'jsonnet' | 'jssm' | 'jsx' | 'julia' | 'kotlin' | 'kusto' | 'latex' | 'lean' | 'less' | 'liquid' | 'llvm' | 'log' | 'logo' | 'lua' | 'luau' | 'make' | 'markdown' | 'marko' | 'matlab' | 'mdc' | 'mdx' | 'mermaid' | 'mipsasm' | 'mojo' | 'move' | 'narrat' | 'nextflow' | 'nginx' | 'nim' | 'nix' | 'nushell' | 'objective-c' | 'objective-cpp' | 'ocaml' | 'pascal' | 'perl' | 'php' | 'plsql' | 'po' | 'polar' | 'postcss' | 'powerquery' | 'powershell' | 'prisma' | 'prolog' | 'proto' | 'pug' | 'puppet' | 'purescript' | 'python' | 'qml' | 'qmldir' | 'qss' | 'r' | 'racket' | 'raku' | 'razor' | 'reg' | 'regexp' | 'rel' | 'riscv' | 'rst' | 'ruby' | 'rust' | 'sas' | 'sass' | 'scala' | 'scheme' | 'scss' | 'sdbl' | 'shaderlab' | 'shellscript' | 'shellsession' | 'smalltalk' | 'solidity' | 'soy' | 'sparql' | 'splunk' | 'sql' | 'ssh-config' | 'stata' | 'stylus' | 'svelte' | 'swift' | 'system-verilog' | 'systemd' | 'talonscript' | 'tasl' | 'tcl' | 'templ' | 'terraform' | 'tex' | 'toml' | 'ts-tags' | 'tsv' | 'tsx' | 'turtle' | 'twig' | 'typescript' | 'typespec' | 'typst' | 'v' | 'vala' | 'vb' | 'verilog' | 'vhdl' | 'viml' | 'vue' | 'vue-html' | 'vyper' | 'wasm' | 'wenyan' | 'wgsl' | 'wikitext' | 'wit' | 'wolfram' | 'xml' | 'xsl' | 'yaml' | 'zenscript' | 'zig' | string

export interface MonacoOptions extends monaco.editor.IStandaloneEditorConstructionOptions {
  MAX_HEIGHT?: number
  readOnly?: boolean
  themes?: MonacoTheme[]
  languages?: MonacoLanguage[]
  // 主题名称，默认为 ['vitesse-dark', 'vitesse-light']
  // 如果需要使用自定义主题，可以传入一个字符串数组 并且 dark 要在前面
  // 例如: ['my-dark-theme', 'my-light-theme']
  // 如果不传入 themes 则使用默认主题 ['vitesse-dark', 'vitesse-light']
  // 如果传入了 themes 则会覆盖默认主题
  theme?: string
}

/**
 * useMonaco 组合式函数
 *
 * 提供 Monaco 编辑器的创建、销毁、内容/主题/语言更新等能力。
 *
 * @param monacoOptions - 编辑器初始化配置，支持 Monaco 原生配置及扩展项
 * @returns {{
 *   createEditor: (container: HTMLElement, code: string, language: string) => Promise<monaco.editor.IStandaloneCodeEditor | null>,
 *   cleanupEditor: () => void,
 *   updateCode: (newCode: string, codeLanguage: string) => void,
 *   setTheme: (theme: MonacoTheme) => void,
 *   setLanguage: (language: MonacoLanguage) => void,
 *   currentTheme: MonacoTheme,
 *   editor: typeof monaco.editor,
 *   editorView: monaco.editor.IStandaloneCodeEditor | null,
 * }}
 *
 * - createEditor(container, code, language): 创建并挂载 Monaco 编辑器
 * - cleanupEditor(): 销毁编辑器并清理容器
 * - updateCode(newCode, codeLanguage): 更新内容和语言，必要时滚动到底部
 * - setTheme(theme): 切换主题
 * - setLanguage(language): 切换语言
 * - currentTheme: 当前主题
 * - editor: Monaco 的静态 editor 对象（一般用于静态方法）
 * - editorView: 当前编辑器实例
 */
export function useMonaco(monacoOptions: MonacoOptions = {}) {
  let editorView: monaco.editor.IStandaloneCodeEditor | null = null

  const themes = monacoOptions.themes ?? ['vitesse-dark', 'vitesse-light']
  if (!Array.isArray(themes) || themes.length < 2) {
    throw new Error('Monaco themes must be an array with at least two themes: [darkTheme, lightTheme]')
  }
  const languages = monacoOptions.languages ?? [
    'jsx',
    'tsx',
    'vue',
    'csharp',
    'python',
    'java',
    'kotlin',
    'c',
    'cpp',
    'rust',
    'go',
    'powershell',
    'sql',
    'yaml',
    'json',
    'html',
    'css',
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
  const MAX_HEIGHT = monacoOptions.MAX_HEIGHT ?? 500
  let lastContainer: HTMLElement | null = null
  let initialTheme = isDark.value ? typeof themes[0] === 'string' ? themes[0] : (themes[0] as any).name : typeof themes[1] === 'string' ? themes[1] : (themes[1] as any).name
  const currentTheme = computed<string>(() => isDark.value ? typeof themes[0] === 'string' ? themes[0] : (themes[0] as any).name : typeof themes[1] === 'string' ? themes[1] : (themes[1] as any).name)
  async function createEditor(container: HTMLElement, code: string, language: string) {
    cleanupEditor()
    lastContainer = container
    // 注册主题和语言
    if (!themeRegisterPromise) {
      themeRegisterPromise = registerMonacoThemes(themes, languages)
    }
    await themeRegisterPromise
    container.style.overflow = 'auto'
    container.style.maxHeight = `${MAX_HEIGHT}px`
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
    editorView = monaco.editor.create(container, {
      value: code,
      language,
      theme: initialTheme,
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
    function updateHeight() {
      const lineCount = editorView!.getModel()?.getLineCount() ?? 1
      const lineHeight = editorView!.getOption(monaco.editor.EditorOption.lineHeight)
      const height = Math.min(lineCount * lineHeight + 16, MAX_HEIGHT)
      container.style.height = `${height}px`
    }

    updateHeight()
    editorView.onDidChangeModelContent(updateHeight)

    // 新增：如果初始化时就有滚动条，滚动到底部
    const model = editorView.getModel()
    const lineCount = model?.getLineCount() ?? 1
    if (
      container.scrollHeight >= MAX_HEIGHT
    ) {
      editorView.revealLine(lineCount)
    }

    return editorView
  }

  onUnmounted(cleanupEditor)

  function cleanupEditor() {
    if (editorView) {
      editorView.dispose()
      editorView = null
    }
    if (lastContainer) {
      lastContainer.innerHTML = ''
      lastContainer = null
    }
  }

  return {
    createEditor,
    cleanupEditor,
    updateCode(newCode: string, codeLanguage: string) {
      if (!editorView)
        return
      const processedCodeLanguage = processedLanguage(codeLanguage)
      const model = editorView.getModel()
      if (!model)
        return
      if (model.getLanguageId() !== processedCodeLanguage) {
        monaco.editor.setModelLanguage(model, processedCodeLanguage)
      }
      // 如果当前主题与 isDark 状态不一致，则切换主题
      if (initialTheme !== currentTheme.value) {
        // 切换主题
        initialTheme = currentTheme.value
        monaco.editor.setTheme(currentTheme.value)
      }
      const prevLineCount = model.getLineCount()
      model.setValue(newCode)
      const newLineCount = model.getLineCount()
      // 只有行数变化且出现滚动条时才滚动到底部
      const container = editorView.getContainerDomNode?.()
      if (
        newLineCount !== prevLineCount
        && container
        && container.scrollHeight >= MAX_HEIGHT
      ) {
        editorView.revealLine(newLineCount)
      }
    },
    setTheme(theme: MonacoTheme) {
      if (themes.includes(theme)) {
        initialTheme = theme
        monaco.editor.setTheme(typeof theme === 'string' ? theme : (theme as any).name)
      }
      else {
        console.warn(`Theme "${theme}" is not registered. Available themes: ${themes.join(', ')}`)
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
        console.warn(`Language "${language}" is not registered. Available languages: ${languages.join(', ')}`)
      }
    },
    get currentTheme() {
      return initialTheme
    },
    get editor() {
      return monaco.editor
    },
    get editorView() {
      return editorView
    },
  }
}

export {
  detectLanguage,
}

// import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
// import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
// import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
// import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
// import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
// // @ts-expect-error monaco global is not defined in this context
// globalThis.MonacoEnvironment = {
//   getWorker(_: any, label: string) {
//     if (label === 'json') {
//       return new JsonWorker()
//     }
//     if (label === 'css' || label === 'scss' || label === 'less') {
//       return new CssWorker()
//     }
//     if (label === 'html' || label === 'handlebars' || label === 'razor') {
//       return new HtmlWorker()
//     }
//     if (label === 'typescript' || label === 'javascript') {
//       return new TsWorker()
//     }
//     return new EditorWorker()
//   },
// }

// monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true)
