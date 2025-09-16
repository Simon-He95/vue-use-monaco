import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: [
      // eslint ignore globs here
      'examples/streaming-demo/src/shims-vue.d.ts',
    ],
  },
  {
    rules: {
      // overrides
    },
  },
)
