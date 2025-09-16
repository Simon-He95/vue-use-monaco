import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'vue-use-monaco': path.resolve(__dirname, '../../src'),
    },
  },
})
