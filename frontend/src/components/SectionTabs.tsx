import { useState, type ReactNode } from 'react'
import { Tabs } from './ui/Tabs'

export interface Section {
  id: string
  label: ReactNode
  /** Small number chip after the label, e.g. how many rows the section holds. */
  count?: number
  /** Optional extra marker after the count (an icon or a short badge). */
  marker?: ReactNode
  /** Controls for this section (an export button, say), shown at the right end of the tab row while it is open. */
  actions?: ReactNode
  content: ReactNode
}

/** A long panel split into tabbed sections: one section is shown at a time. */
export function SectionTabs({ label, sections }: { label: string; sections: Section[] }) {
  const visible = sections.filter(Boolean)
  const [active, setActive] = useState(visible[0]?.id ?? '')
  const current = visible.find((s) => s.id === active) ?? visible[0]
  if (!current) return null
  return (
    <div className={current.actions ? 'section-tabs has-actions' : 'section-tabs'}>
      <Tabs
        label={label}
        value={current.id}
        onChange={setActive}
        tabs={visible.map((s) => ({
          id: s.id,
          label: (
            <>
              {s.label}
              {s.count != null && <span className="ss-tab__count">{s.count}</span>}
              {s.marker}
            </>
          ),
        }))}
      />
      {/* Beside the tabs, not around them: the tab strip's styles target `.section-tabs > .tabs`. */}
      {current.actions && <div className="section-tabs__actions">{current.actions}</div>}
      <div className="section-tabs__body" role="tabpanel" aria-label={current.id}>
        {current.content}
      </div>
    </div>
  )
}
