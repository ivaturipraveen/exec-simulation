import { Moon, Sun } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { currentTheme, setTheme, subscribeTheme } from '../lib/theme'

export function ThemeToggle() {
  // Shared with every other toggle and window, so they never disagree about the theme.
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => 'light' as const)
  const next = theme === 'light' ? 'dark' : 'light'
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
