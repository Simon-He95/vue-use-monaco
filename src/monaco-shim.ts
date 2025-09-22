// Small shim to centralize the monaco import. Tests can mock this file to
// avoid resolving the real 'monaco-editor' package during vitest runs.
import * as _monaco from 'monaco-editor'

// re-export the original module but also provide a `monaco` namespace default
// so existing imports like `import * as monaco from '.../monaco-shim'` keep
// the `monaco.editor` typing available.
const monaco: typeof _monaco = _monaco as any

export { monaco as default }
export * from 'monaco-editor'
