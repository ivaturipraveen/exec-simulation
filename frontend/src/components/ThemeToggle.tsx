import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { storage } from '../lib/storage'
import { applyTheme as apply, type Theme } from '../lib/theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(
    () => (storage.get('execsim.theme') as Theme) ?? 'system',
  )
  useEffect(() => {
    apply(theme)
    storage.set('execsim.theme', theme)
  }, [theme])
  const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  return (
    <button
      className="btn btn--ghost btn--sm"
      type="button"
      onClick={() => setTheme(next[theme])}
      aria-label={`Theme: ${theme}. Switch theme`}
      title={`Theme: ${theme}`}
    >
      <Icon aria-hidden />
    </button>
  )
}
