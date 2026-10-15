import { storage } from './storage'

export type Theme = 'light' | 'dark'

const KEY = 'execsim.theme'
const listeners = new Set<() => void>()

/** Stored choice, or the OS preference on first visit (older 'system' values resolve the same way). */
export function currentTheme(): Theme {
  const saved = storage.get(KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

function refresh() {
  applyTheme(currentTheme())
  listeners.forEach((l) => l())
}

/** Choose a theme: applies it here, remembers it, and updates every open window of the app. */
export function setTheme(theme: Theme) {
  storage.set(KEY, theme)
  refresh()
}

/** For useSyncExternalStore: every theme button and page re-renders when the theme changes. */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function initTheme() {
  applyTheme(currentTheme())
  if (typeof window === 'undefined') return
  // Another window (e.g. the console opening the projector) changed the theme.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) refresh()
  })
  // No saved choice yet: follow the operating system when it switches.
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (!storage.get(KEY)) refresh()
  })
}
