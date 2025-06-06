## vue-use-monaco

[![npm](https://img.shields.io/npm/v/vue-use-monaco)](https://www.npmjs.com/package/vue-use-monaco)
[![license](https://img.shields.io/npm/l/vue-use-monaco)](./license)

### 项目简介

`useMonaco` 是一个结合 Vue、Monaco 编辑器和 Shiki 语法高亮的库，旨在快速应对流式输入更新并提供高效的高亮更新功能。它适用于需要实时代码编辑和高亮的场景。

### 特性

- 集成 Monaco 编辑器，提供强大的代码编辑功能。
- 使用 Shiki 实现高效的语法高亮。
- 支持流式输入更新，实时响应。

### 安装

使用 pnpm 安装：

```bash
pnpm add use-monaco
```

### 使用方法

在 Vue 项目中快速集成：

```vue
<script>
import { defineComponent, ref } from 'vue'
import { useMonaco } from 'vue-use-monaco'

export default defineComponent({
  setup() {
    const code = ref('')
    const editorOptions = {
      language: 'javascript',
      theme: 'vs-dark',
    }

    const { createEditor, updateCode } = useMonaco({
      themes: ['vitesse-dark', 'vitesse-light'],
      languages: ['javascript', 'typescript', 'vue'],
    })

    const editor = createEditor(document.getElementById('editor-container'), code.value, editorOptions.language)

    // 更新代码内容
    updateCode('新的代码内容', 'javascript')

    return { code, editorOptions }
  },
})
</script>

<template>
  <MonacoEditor v-model="code" :options="editorOptions" />
</template>
```

通过 `useMonaco` 组合式函数，可以调用 `createEditor` 和 `updateCode` 方法来初始化编辑器和更新代码内容。

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
