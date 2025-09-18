// Expose a function so consumers can proactively preload worker loaders
// without relying on module evaluation timing.
export async function preloadMonacoWorkers(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined')
    return
  // Resolve worker files relative to this module so dev servers (Vite) and
  // production builds serve the real JS files instead of falling back to
  // `index.html` (which would return text/html and trigger the MIME error).
  const workerUrlByLabel: Record<string, URL> = {
    json: new URL('./worker/json.worker.js', import.meta.url),
    css: new URL('./worker/css.worker.js', import.meta.url),
    scss: new URL('./worker/css.worker.js', import.meta.url),
    less: new URL('./worker/css.worker.js', import.meta.url),
    html: new URL('./worker/html.worker.js', import.meta.url),
    handlebars: new URL('./worker/html.worker.js', import.meta.url),
    razor: new URL('./worker/html.worker.js', import.meta.url),
    typescript: new URL('./worker/ts.worker.js', import.meta.url),
    javascript: new URL('./worker/ts.worker.js', import.meta.url),
    editorWorkerService: new URL('./worker/editor.worker.js', import.meta.url),
  }

  try {
    // eslint-disable-next-line no-restricted-globals
    ; (self as any).MonacoEnvironment = {
      getWorker(_: any, label: string) {
        const url = workerUrlByLabel[label] ?? workerUrlByLabel.editorWorkerService
        // Worker accepts URL objects; allow bundlers to detect the dependency.
        return new Worker(url, { type: 'module' })
      },
    }
  }
  catch {
    // swallow errors - preloading is best-effort

  }

  const urls = Object.values(workerUrlByLabel)
  // insert preload links for each unique href
  const seen = new Set<string>()
  for (const u of urls) {
    const href = u.href
    if (seen.has(href))
      continue
    seen.add(href)
    try {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'script'
      link.href = href
      // noop if adding fails
      document.head.appendChild(link)
    }
    catch {
      // ignore DOM insertion errors
    }
  }
}
