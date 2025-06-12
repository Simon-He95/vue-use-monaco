## vue-use-monaco

[![npm](https://img.shields.io/npm/v/vue-use-monaco)](https://www.npmjs.com/package/vue-use-monaco)
[![license](https://img.shields.io/npm/l/vue-use-monaco)](./license)

### 项目简介

`useMonaco` 是一个结合 Vue、Monaco 编辑器和 Shiki 语法高亮的库，旨在快速应对流式输入更新并提供高效的高亮更新功能。它适用于需要实时代码编辑和高亮的场景。

### 特性

- 集成 Monaco 编辑器，提供强大的代码编辑功能。
- 使用 Shiki 实现高效的语法高亮。
- 支持流式输入更新，实时响应。
- 自动监听 isDark 模式变化，自动切换主题。
- 自动销毁编辑器实例，避免内存泄漏。

### 安装

使用 pnpm 安装：

```bash
pnpm add use-monaco
```

### 使用方法

在 Vue 项目中快速集成：

```vue
<script>
import { defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { useMonaco } from 'vue-use-monaco'

export default defineComponent({
  name: 'MonacoEditor',
  props: {
    code: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const codeEditor = ref<HTMLElement | null>(null)
    const { createEditor, updateCode, cleanupEditor } = useMonaco({
      themes: ['vitesse-dark', 'vitesse-light'],
      languages: ['javascript', 'typescript', 'vue'],
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
      }
    )

    return {
      codeEditor,
    }
  },
})
</script>

<template>
  <div ref="codeEditor" />
</template>
```

通过 `useMonaco` 组合式函数，可以调用 `createEditor` 和 `updateCode` 方法来初始化编辑器和更新代码内容。

## 配置说明

在使用 Monaco 编辑器时，如果需要全局注入 worker，建议使用 [vite-plugin-monaco-editor-esm](https://www.npmjs.com/package/vite-plugin-monaco-editor-esm) 插件进行处理。特别是在 Windows 环境下打包时，可能会遇到问题，需要配置 `customDistPath` 来确保打包成功。

以下是配置示例：

```javascript
import path from 'node:path'
// vite.config.js
import monacoEditorPlugin from 'vite-plugin-monaco-editor-esm'

export default {
  plugins: [
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
}
```

通过上述配置，可以解决 Monaco 编辑器在 Windows 环境下打包时的相关问题。

### 贡献

欢迎提交 Issue 或 PR 来改进此项目！

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

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — 微软出品的强大代码编辑器内核。
- [Shiki](https://shiki.matsu.io/) — 基于 TextMate 语法和 VS Code 主题的代码高亮库。
