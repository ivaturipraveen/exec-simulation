import type { ReactNode } from 'react'

interface Item {
  id: string
  title: string
  value: number
  /** Average of the four readiness scores (data, workflow, owner, controls), 1–5. */
  readiness: number
  foundations?: string[]
  meta?: ReactNode
}

/** Pack 10.3: value and readiness at or above the cut-offs → act now; high value, lower
 * readiness → strategic. Cut-offs come from content (opportunity.act_now_*). */
const quadrants = (V: number, R: number) => [
  {
    key: 'strategic',
    hint: 'High value · lower readiness',
    title: 'Strategic initiative',
    sub: 'Foundation, operating model or phased roadmap',
    test: (i: Item) => i.value >= V && i.readiness < R,
  },
  {
    key: 'act_now',
    hint: 'High value · high readiness',
    title: 'Act now',
    sub: 'Prioritized pilot or productivity win',
    test: (i: Item) => i.value >= V && i.readiness >= R,
  },
  {
    key: 'defer',
    hint: 'Lower value · lower readiness',
    title: 'Defer',
    sub: 'Low value · low readiness',
    test: (i: Item) => i.value < V && i.readiness < R,
  },
  {
    key: 'quick_win',
    hint: 'Lower value · high readiness',
    title: 'Selective quick win',
    sub: 'Only if learning or capacity benefit is clear',
    test: (i: Item) => i.value < V && i.readiness >= R,
  },
]

export function OpportunityMatrix({
  items,
  themes = [],
  minLinks = 3,
  valueCut = 4,
  readinessCut = 4,
}: {
  items: Item[]
  themes?: string[]
  minLinks?: number
  valueCut?: number
  readinessCut?: number
}) {
  const QUADRANTS = quadrants(valueCut, readinessCut)
  const band = themes
    .map((t) => ({ theme: t, links: items.filter((i) => i.foundations?.includes(t)).length }))
    .filter((b) => b.links > 0)
    .sort((a, b) => b.links - a.links)
  return (
    <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
      <div className="opp-matrix" role="list" aria-label="AI Opportunity Map">
        <div className="opp-matrix__grid">
          {QUADRANTS.map((q) => {
            const inQ = items.filter(q.test)
            return (
              <section
                key={q.key}
                className={`opp-q opp-q--${q.key}`}
                role="listitem"
                aria-label={`${q.title}: ${inQ.length}`}
                title={q.hint}
              >
                <header>
                  <span className="strong small">
                    {q.title} <span className="ss-tab__count">{inQ.length}</span>
                  </span>
                  <span className="xs muted">{q.sub}</span>
                </header>
                {inQ.length === 0 && (
                  <span className="opp-q__empty">No opportunities here yet</span>
                )}
                <ul className="list-reset stack" style={{ '--gap': '6px' } as React.CSSProperties}>
                  {inQ.map((i) => (
                    <li key={i.id} className="opp-chip">
                      <span className="strong">{i.title}</span>
                      {i.meta && <span className="xs muted">{i.meta}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </div>
      <div className="opp-foundation">
        <span className="strong small">Foundational band</span>
        <span className="xs muted"> — a theme that enables {minLinks} or more opportunities</span>
        <div className="chip-list" style={{ marginTop: 6 }}>
          {band.length ? (
            band.map((b) => (
              <span
                key={b.theme}
                className={`badge ${b.links >= minLinks ? 'badge--accent' : 'badge--outline'}`}
              >
                {b.theme} · {b.links}
              </span>
            ))
          ) : (
            <span className="xs muted">Tag opportunities with the foundations they depend on</span>
          )}
        </div>
      </div>
    </div>
  )
}
