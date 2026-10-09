/** Quarterly capacity demand vs supply for the round's year (pack A-16; above the overrun threshold everything slows). */
export function CapacityPlan({
  utilization,
  labels,
  cap = 1.5,
}: {
  utilization: number[]
  labels: string[]
  /** Overrun threshold (share of supply) from the session's rules. */
  cap?: number
}) {
  if (!utilization.length) return null
  const max = Math.max(cap + 0.1, ...utilization)
  return (
    <div className="capacity" role="img" aria-label="Capacity demand by quarter">
      <div className="row spread">
        <span className="upper muted">Capacity demand</span>
        <span className="xs muted">100% = your points per quarter</span>
      </div>
      <div className="capacity__bars">
        <span
          className="capacity__line"
          style={{ bottom: `${(1 / max) * 100}%` }}
          title="100% of supply"
        />
        <span
          className="capacity__line capacity__line--danger"
          style={{ bottom: `${(cap / max) * 100}%` }}
          title={`${Math.round(cap * 100)}%: overrun threshold`}
        />
        {utilization.map((u, i) => {
          const tone = u > cap ? 'critical' : u > 1 ? 'warning' : 'good'
          return (
            <div key={i} className="capacity__col">
              <span className="capacity__val num">{Math.round(u * 100)}%</span>
              <div
                className={`capacity__bar capacity__bar--${tone}`}
                style={{ height: `${(u / max) * 100}%` }}
              />
              <span className="capacity__label">{labels[i]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
