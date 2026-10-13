import { Flag } from 'lucide-react'
import { useScoreboard } from '../api/hooks'
import type { SessionView } from '../api/types'
import { GroupedBars, type Series } from '../components/charts'
import { SectionTabs } from '../components/SectionTabs'
import { Card } from '../components/ui/Card'
import { Badge, Callout, Empty, Loading } from '../components/ui/primitives'

const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)']

export function ResultsPanel({ session, token }: { session: SessionView; token: string }) {
  const { data } = useScoreboard(session.id, token, session.simulated_years >= 1)
  if (session.simulated_years < 1)
    return <Empty title="No results yet">Results appear after Year 1 is simulated.</Empty>
  if (!data) return <Loading />
  const series: Series[] = data.map((d, i) => ({
    key: d.team_id,
    label: d.team_name,
    color: COLORS[i],
  }))
  const dims = data[0]?.scorecard.dimensions ?? []
  const rows = dims.map((dim) => ({
    label: dim.label,
    ...Object.fromEntries(
      data.map((d) => [d.team_id, d.scorecard.dimensions.find((x) => x.id === dim.id)?.score ?? 0]),
    ),
  }))
  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      {session.simulated_years < 2 && (
        <Callout tone="neutral">
          Interim view after Year 1 — operating model and crisis are not yet scored.
        </Callout>
      )}
      <SectionTabs
        label="Results sections"
        sections={[
          {
            id: 'scoreboard',
            label: 'Scoreboard',
            count: data.length,
            content: (
              <Card
                title="Scoreboard"
                subtitle="Normalized to each organization's own mandate"
                flush
              >
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th className="num">Total</th>
                      <th className="num">Stars</th>
                      <th>Guardrails</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((d, i) => (
                      <tr key={d.team_id}>
                        <td className="num">{i + 1}</td>
                        <td>
                          <div className="strong">{d.team_name}</div>
                          <div className="xs muted">{d.archetype}</div>
                        </td>
                        <td className="num strong">{d.scorecard.total.toFixed(1)}</td>
                        <td className="num">
                          {d.scorecard.stars_start.toFixed(1)} → {d.scorecard.stars_year.toFixed(1)}{' '}
                          → {d.scorecard.stars_projected.toFixed(1)}{' '}
                          <span className="muted">/ {d.scorecard.stars_target.toFixed(1)}</span>
                        </td>
                        <td>
                          {d.scorecard.flags.length ? (
                            d.scorecard.flags.map((f) => (
                              <Badge
                                key={f}
                                tone={/^E\d/.test(f) ? 'warning' : 'critical'}
                                icon={<Flag aria-hidden />}
                              >
                                {f.split(':')[0]}
                              </Badge>
                            ))
                          ) : (
                            <Badge tone="good">None</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ),
          },
          {
            id: 'profile',
            label: 'Dimension profile',
            content: (
              <Card title="Dimension profile by team">
                <GroupedBars data={rows} series={series} format={(v) => v.toFixed(0)} />
              </Card>
            ),
          },
          {
            id: 'teams',
            label: 'Team breakdown',
            content: (
              <div className="grid grid-3">
                {data.map((d, rank) => {
                  const sc = d.scorecard
                  return (
                    <section key={d.team_id} className="card tp" aria-label={d.team_name}>
                      <header className="tp__head">
                        <div className="grow">
                          <div className="tp__name">{d.team_name}</div>
                          <div className="tp__payer">{d.archetype}</div>
                        </div>
                        <span className={`rank-chip ${rank === 0 ? 'is-first' : ''}`}>
                          #{rank + 1}
                        </span>
                      </header>
                      <div className="tp__stats">
                        <div>
                          <span className="tp__stat-label">Total score</span>
                          <span className="tp__stat-value num">{sc.total.toFixed(0)}</span>
                          <span className="tp__stat-sub">of 100</span>
                        </div>
                        <div>
                          <span className="tp__stat-label">Stars</span>
                          <span className="tp__stat-value num">
                            {sc.stars_start.toFixed(1)} → {sc.stars_projected.toFixed(1)}
                          </span>
                          <span className="tp__stat-sub">target {sc.stars_target.toFixed(1)}</span>
                        </div>
                        <div>
                          <span className="tp__stat-label">Crisis</span>
                          <span className="tp__stat-value num">
                            {sc.crisis_event ? `${sc.crisis_total ?? '—'}/18` : '—'}
                          </span>
                          <span className="tp__stat-sub">
                            {sc.crisis_event
                              ? `${sc.crisis_event.toUpperCase()} ${sc.crisis_severity ?? ''}`
                              : 'none fired'}
                          </span>
                        </div>
                      </div>
                      <ul className="list-reset dim-list">
                        {sc.dimensions.map((dim) => (
                          <li key={dim.id}>
                            <div className="dim-list__head">
                              <span className="strong small">{dim.label}</span>
                              <span className="dim-list__score num">
                                {dim.score.toFixed(0)}
                                <span className="muted"> · {Math.round(dim.weight * 100)}%</span>
                              </span>
                            </div>
                            <span className="dim-list__bar" aria-hidden>
                              <span
                                style={{ width: `${Math.max(0, Math.min(100, dim.score))}%` }}
                              />
                            </span>
                            {dim.drivers[0] && <p className="xs secondary">{dim.drivers[0]}</p>}
                          </li>
                        ))}
                      </ul>
                      <div className="tp__current is-missed">
                        <span className="tp__current-label">Trap</span>
                        <span className="tp__current-text">{d.trap_title}</span>
                      </div>
                    </section>
                  )
                })}
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
