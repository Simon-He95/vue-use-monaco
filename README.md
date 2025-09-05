## vue-use-monaco

[![npm](https://img.shields.io/npm/v/vue-use-monaco)](https://www.npmjs.com/package/vue-use-monaco)
[![license](https://img.shields.io/npm/l/vue-use-monaco)](./license)

### 项目简介

`vue-use-monaco` 是一个结合 Vue、Monaco 编辑器和 Shiki 语法高亮的组合式函数库，专为流式输入更新和高效代码高亮而设计。它提供了完整的 Monaco 编辑器集成方案，适用于需要实时代码编辑和高亮的场景。

### 特性

- 🚀 **开箱即用** - 基于 Vue 3 组合式 API 设计
- 🎨 **Shiki 高亮** - 使用 Shiki 实现高效的语法高亮，支持 TextMate 语法和 VS Code 主题
- 🌓 **主题切换** - 自动监听 isDark 模式变化，智能切换明暗主题
- 📝 **流式更新** - 支持流式输入更新，实时响应代码变化
- 🗑️ **内存管理** - 自动销毁编辑器实例，避免内存泄漏
- 🔧 **高度可配置** - 支持所有 Monaco 编辑器原生配置选项
- 🎯 **TypeScript 支持** - 完整的 TypeScript 类型定义

### 安装

使用 pnpm 安装：

```bash
pnpm add vue-use-monaco
```

使用 npm 安装：

```bash
npm install vue-use-monaco
```

使用 yarn 安装：

```bash
yarn add vue-use-monaco
```

### 基础使用

#### 简单示例

```vue
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useMonaco } from 'vue-use-monaco'

const props = defineProps<{
  code: string
  language: string
}>()

const codeEditor = ref<HTMLElement>()

const { createEditor, updateCode, cleanupEditor } = useMonaco({
  themes: ['vitesse-dark', 'vitesse-light'],
  languages: ['javascript', 'typescript', 'vue', 'python'],
  readOnly: false,
  MAX_HEIGHT: 600,
})

// 创建编辑器实例
onMounted(async () => {
  if (codeEditor.value) {
    await createEditor(codeEditor.value, props.code, props.language)
  }
})

// 监听代码和语言变化
watch(
  () => [props.code, props.language],
  ([newCode, newLanguage]) => {
    updateCode(newCode, newLanguage)
  },
)
</script>

<template>
  <div ref="codeEditor" class="monaco-editor-container" />
</template>

<style scoped>
.monaco-editor-container {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}
</style>
```

#### 完整配置示例

```vue
<script setup lang="ts">
import type { MonacoLanguage, MonacoTheme } from 'vue-use-monaco'
import { onMounted, ref } from 'vue'
import { useMonaco } from 'vue-use-monaco'

const editorContainer = ref<HTMLElement>()

const {
  createEditor,
  updateCode,
  setTheme,
  setLanguage,
  getCurrentTheme,
  getEditor,
  getEditorView,
  cleanupEditor,
} = useMonaco({
  // 主题配置 - 至少需要两个主题（暗色/亮色）
  themes: ['github-dark', 'github-light'],

  // 支持的语言列表
  languages: ['javascript', 'typescript', 'python', 'vue', 'json'],

  // 编辑器最大高度
  MAX_HEIGHT: 500,

  // 是否只读
  readOnly: false,

  // 是否在创建前清理之前的资源
  isCleanOnBeforeCreate: true,

  // 创建前的钩子函数
  onBeforeCreate: (monaco) => {
    // 可以在这里注册自定义语言、主题等
    console.log('Monaco editor is about to be created', monaco)
    return [] // 返回需要清理的 disposable 对象数组
  },

  // Monaco 编辑器原生配置
  fontSize: 14,
  lineNumbers: 'on',
  wordWrap: 'on',
  minimap: { enabled: false },
  scrollbar: {
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
    alwaysConsumeMouseWheel: false,
  },
})

onMounted(async () => {
  if (editorContainer.value) {
    const editor = await createEditor(
      editorContainer.value,
      'console.log("Hello, Monaco!")',
      'javascript',
    )

    console.log('Editor created:', editor)
  }
})

// 主题切换
function switchTheme(theme: MonacoTheme) {
  setTheme(theme)
}

// 语言切换
function switchLanguage(language: MonacoLanguage) {
  setLanguage(language)
}

// 更新代码
function updateEditorCode(code: string, language: string) {
  updateCode(code, language)
}

// 获取当前主题
const currentTheme = getCurrentTheme()
console.log('Current theme:', currentTheme)

// 获取 Monaco 静态 API
const monacoEditor = getEditor()
console.log('Monaco editor API:', monacoEditor)

// 获取编辑器实例
const editorInstance = getEditorView()
console.log('Editor instance:', editorInstance)
</script>

<template>
  <div>
    <div class="controls">
      <button @click="switchTheme('github-dark')">
        暗色主题
      </button>
      <button @click="switchTheme('github-light')">
        亮色主题
      </button>
      <button @click="switchLanguage('typescript')">
        TypeScript
      </button>
      <button @click="switchLanguage('python')">
        Python
      </button>
    </div>
    <div ref="editorContainer" class="editor" />
  </div>
</template>
```

### API 参考

#### useMonaco(options?)

##### 参数

| 参数                    | 类型               | 默认值                              | 描述                           |
| ----------------------- | ------------------ | ----------------------------------- | ------------------------------ |
| `MAX_HEIGHT`            | `number`           | `500`                               | 编辑器最大高度（像素）         |
| `readOnly`              | `boolean`          | `true`                              | 是否为只读模式                 |
| `themes`                | `MonacoTheme[]`    | `['vitesse-dark', 'vitesse-light']` | 主题数组，至少包含两个主题     |
| `languages`             | `MonacoLanguage[]` | 见默认语言列表                      | 支持的编程语言数组             |
| `theme`                 | `string`           | -                                   | 初始主题名称                   |
| `isCleanOnBeforeCreate` | `boolean`          | `true`                              | 是否在创建前清理之前注册的资源 |
| `onBeforeCreate`        | `function`         | -                                   | 编辑器创建前的钩子函数         |

##### 返回值

| 方法/属性         | 类型                                                                                | 描述                           |
| ----------------- | ----------------------------------------------------------------------------------- | ------------------------------ |
| `createEditor`    | `(container: HTMLElement, code: string, language: string) => Promise<MonacoEditor>` | 创建并挂载编辑器到指定容器     |
| `cleanupEditor`   | `() => void`                                                                        | 销毁编辑器并清理容器           |
| `updateCode`      | `(newCode: string, codeLanguage: string) => void`                                   | 更新编辑器内容和语言           |
| `setTheme`        | `(theme: MonacoTheme) => void`                                                      | 切换编辑器主题                 |
| `setLanguage`     | `(language: MonacoLanguage) => void`                                                | 切换编辑器语言                 |
| `getCurrentTheme` | `() => string`                                                                      | 获取当前主题名称               |
| `getEditor`       | `() => typeof monaco.editor`                                                        | 获取 Monaco 的静态 editor 对象 |
| `getEditorView`   | `() => MonacoEditor \| null`                                                        | 获取当前编辑器实例             |

#### 支持的主题

包括但不限于：

- `vitesse-dark` / `vitesse-light`
- `github-dark` / `github-light`
- `dracula` / `dracula-soft`
- `one-dark-pro` / `one-light`
- `tokyo-night`
- `material-theme` 系列
- `catppuccin` 系列
- 以及更多...

#### 支持的语言

包括但不限于：

- `javascript` / `typescript` / `jsx` / `tsx`
- `vue` / `html` / `css` / `scss` / `less`
- `python` / `java` / `csharp` / `cpp` / `rust` / `go`
- `json` / `yaml` / `toml` / `xml`
- `markdown` / `dockerfile`
- 以及 100+ 种语言...

### 配置说明

#### Vite 配置

在使用 Monaco 编辑器时，建议使用 [vite-plugin-monaco-editor-esm](https://www.npmjs.com/package/vite-plugin-monaco-editor-esm) 插件处理 Web Workers。

```javascript
import path from 'node:path'
import vue from '@vitejs/plugin-vue'
// vite.config.js
import { defineConfig } from 'vite'
import monacoEditorPlugin from 'vite-plugin-monaco-editor-esm'

export default defineConfig({
  plugins: [
    vue(),
    monacoEditorPlugin({
      languageWorkers: [
        'editorWorkerService',
        'typescript',
        'css',
        'html',
        'json',
      ],
      customDistPath(root, buildOutDir, base) {
        return path.resolve(buildOutDir, 'monacoeditorwork')
      },
    }),
  ],
})
```

#### Webpack 配置

如果使用 Webpack，可以使用 `monaco-editor-webpack-plugin`：

```javascript
// webpack.config.js
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin')

module.exports = {
  plugins: [
    new MonacoWebpackPlugin({
      languages: ['javascript', 'typescript', 'css', 'html', 'json'],
    }),
  ],
}
```

### 最佳实践

#### 1. 性能优化

```typescript
// 只加载需要的语言，减少包体积
const { createEditor } = useMonaco({
  languages: ['javascript', 'typescript'], // 只加载必要的语言
  themes: ['vitesse-dark', 'vitesse-light'],
})
```

#### 2. 内存管理

```vue
<script setup>
import { onUnmounted } from 'vue'

const { createEditor, cleanupEditor } = useMonaco()

// 组件卸载时自动清理（useMonaco 内部已处理）
// 但如果需要手动清理，可以调用：
onUnmounted(() => {
  cleanupEditor()
})
</script>
```

#### 3. 主题跟随系统

```typescript
import { useDark } from '@vueuse/core'

const isDark = useDark()

const { createEditor, setTheme } = useMonaco({
  themes: ['github-dark', 'github-light'],
})

// 主题会自动跟随 isDark 状态切换
```

### 故障排除

#### 1. 打包后编辑器无法显示

确保正确配置了 Monaco Editor 的 Web Workers（参考上面的 Vite/Webpack 配置）。

#### 2. 主题不生效

检查主题名称是否正确，确保主题已在 `themes` 数组中注册。

#### 3. 语言高亮不工作

确保语言已在 `languages` 数组中包含，并且 Shiki 支持该语言。

### 贡献

欢迎提交 Issue 或 PR 来改进此项目！

### 开发

```bash
# 克隆项目
git clone https://github.com/Simon-He95/vue-use-monaco.git

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建
pnpm build
```

### :coffee:

[buy me a cup of coffee](https://github.com/Simon-He95/sponsor)

### License

[MIT](./license)

### Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.svg">
    <img src="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.png"/>
  </a>
</p>

## 致谢

本项目感谢以下开源库的支持：

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — 微软出品的强大代码编辑器内核
- [Shiki](https://shiki.matsu.io/) — 基于 TextMate 语法和 VS Code 主题的代码高亮库
- [Vue.js](https://vuejs.org/) — 渐进式 JavaScript 框架
- [@shikijs/monaco](https://github.com/shikijs/shiki) — Shiki 与 Monaco Editor 的集成
