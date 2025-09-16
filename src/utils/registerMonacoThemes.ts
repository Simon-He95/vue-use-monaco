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

  try {
    const highlighter = await createHighlighter({
      themes,
      langs: languages,
    })
    shikiToMonaco(highlighter, monaco)

    themesRegistered = true
    currentThemes = themes
    currentLanguages = languages
  }
  catch (e) {
    themeRegisterPromise = null
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
