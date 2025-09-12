import type { MonacoTheme } from './type'

export const defaultLanguages = [
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
export const defaultThemes: MonacoTheme[] = ['vitesse-dark', 'vitesse-light']
export const defaultScrollbar = {
  verticalScrollbarSize: 8,
  horizontalScrollbarSize: 8,
  handleMouseWheel: true,
  /**
   * 是否始终消费鼠标滚轮事件，默认为 false
   * 如果为 true，则鼠标滚轮事件不会传递给其他元素
   */
  alwaysConsumeMouseWheel: false,
}
