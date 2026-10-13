import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { storage } from '../lib/storage'
import { applyTheme as apply, currentTheme, type Theme } from '../lib/theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme)
  useEffect(() => {
    apply(theme)
    storage.set('execsim.theme', theme)
  }, [theme])
  const next: Theme = theme === 'light' ? 'dark' : 'light'
  const Icon = theme === 'light' ? Moon : Sun
  return (
    <button
      className="btn btn--ghost btn--sm btn--icon"
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      <Icon aria-hidden />
    </button>
  )
}
