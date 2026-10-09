import { storage } from './storage'

export type Theme = 'system' | 'light' | 'dark'

export function applyTheme(theme: Theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
}

export function initTheme() {
  applyTheme((storage.get('execsim.theme') as Theme) ?? 'system')
}
