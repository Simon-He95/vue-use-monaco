import type { SpecialTheme, ThemeInput } from 'shiki'
import { shikiToMonaco } from '@shikijs/monaco'
import * as monaco from 'monaco-editor'
import { createHighlighter } from 'shiki'
import { arraysEqual } from './arraysEqual'

let themesRegistered = false
let languagesRegistered = false
let currentThemes: (ThemeInput | string | SpecialTheme)[] = []
let currentLanguages: string[] = []
let themeRegisterPromise: Promise<void> | null = null
export function getThemeRegisterPromise() {
  return themeRegisterPromise
}
export function setThemeRegisterPromise(p: Promise<void> | null) {
  return themeRegisterPromise = p
}

interface HighlighterEntry {
  // promise that resolves to a shiki highlighter
  promise: Promise<any>
  // set of languages this highlighter was created with
  languages: Set<string>
}

const highlighterCache = new Map<string, HighlighterEntry>()

function serializeThemes(themes: (ThemeInput | string | SpecialTheme)[]) {
  return JSON.stringify(
    themes.map(t => typeof t === 'string' ? t : (t as any).name ?? JSON.stringify(t)).sort(),
  )
}

async function getOrCreateHighlighter(
  themes: (ThemeInput | string | SpecialTheme)[],
  languages: string[],
) {
  const key = serializeThemes(themes)
  const requestedSet = new Set(languages)
  const existing = highlighterCache.get(key)

  if (existing) {
    // if existing entry already covers requested languages, reuse
    let allIncluded = true
    for (const l of requestedSet) {
      if (!existing.languages.has(l)) {
        allIncluded = false
        break
      }
    }
    if (allIncluded) {
      return existing.promise
    }

    // otherwise create a new highlighter with the union of languages
    const union = new Set<string>([...existing.languages, ...requestedSet])
    const langsArray = Array.from(union)
    const p = createHighlighter({ themes, langs: langsArray })
    const newEntry: HighlighterEntry = { promise: p, languages: union }
    highlighterCache.set(key, newEntry)

    // if creation fails, try to restore previous entry
    p.catch(() => {
      if (highlighterCache.get(key) === newEntry && existing) {
        highlighterCache.set(key, existing)
      }
    })

    return p
  }

  // no cached entry, create and cache
  const p = createHighlighter({ themes, langs: Array.from(requestedSet) })
  const entry: HighlighterEntry = { promise: p, languages: requestedSet }
  highlighterCache.set(key, entry)
  p.catch(() => {
    if (highlighterCache.get(key) === entry) {
      highlighterCache.delete(key)
    }
  })
  return p
}
export async function registerMonacoThemes(
  themes: (ThemeInput | string | SpecialTheme)[],
  languages: string[],
) {
  registerMonacoLanguages(languages)

  if (
    themesRegistered
    && arraysEqual(themes, currentThemes)
    && arraysEqual(languages, currentLanguages)
  ) {
    return
  }

  const p = (async () => {
    const highlighter = await getOrCreateHighlighter(themes, languages)
    shikiToMonaco(highlighter, monaco)

    themesRegistered = true
    currentThemes = themes
    currentLanguages = languages
  })()

  setThemeRegisterPromise(p)
  try {
    await p
  }
  catch (e) {
    setThemeRegisterPromise(null)
    throw e
  }
}

function registerMonacoLanguages(languages: string[]) {
  if (languagesRegistered && arraysEqual(languages, currentLanguages)) {
    return
  }

  const existing = new Set(monaco.languages.getLanguages().map(l => l.id))
  for (const lang of languages) {
    if (!existing.has(lang)) {
      try {
        monaco.languages.register({ id: lang })
      }
      catch {
        // ignore unsupported ids
      }
    }
  }

  languagesRegistered = true
  currentLanguages = languages
}
