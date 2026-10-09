import { useCallback, useState, type ReactNode } from 'react'
import { ToastContext } from './toastContext'

interface ToastItem {
  id: number
  message: string
  tone: 'info' | 'error'
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((message: string, tone: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random()
    setItems((xs) => [...xs, { id, message, tone }])
    window.setTimeout(
      () => setItems((xs) => xs.filter((x) => x.id !== id)),
      tone === 'error' ? 6000 : 3500,
    )
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={`toast ${t.tone === 'error' ? 'toast--error' : ''}`}
            role={t.tone === 'error' ? 'alert' : 'status'}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
