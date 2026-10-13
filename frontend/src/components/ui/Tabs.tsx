import { useRef, type ReactNode } from 'react'

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
}: {
  value: T
  onChange: (v: T) => void
  tabs: { id: T; label: ReactNode; disabled?: boolean }[]
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Switching tabs swaps the content below; if the user has scrolled past the tab row, bring it
  // back into view (below any sticky header) so the page does not snap or strand them mid-page.
  const select = (id: T) => {
    onChange(id)
    const el = ref.current
    if (!el) return
    const header = document.querySelector<HTMLElement>('.topbar, .fac__top, .settings__top')
    const offset =
      (header && getComputedStyle(header).position === 'sticky' ? header.offsetHeight : 0) + 12
    const top = el.getBoundingClientRect().top
    if (top < offset) window.scrollBy({ top: top - offset, behavior: 'smooth' })
  }
  return (
    <div className="tabs" role="tablist" aria-label={label} ref={ref}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={t.id === value}
          disabled={t.disabled}
          onClick={() => select(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
