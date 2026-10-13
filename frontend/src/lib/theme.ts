import { storage } from './storage'

export type Theme = 'light' | 'dark'

/** Stored choice, or the OS preference on first visit (older 'system' values resolve the same way). */
export function currentTheme(): Theme {
  const saved = storage.get('execsim.theme')
  if (saved === 'light' || saved === 'dark') return saved
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function initTheme() {
  applyTheme(currentTheme())
}
