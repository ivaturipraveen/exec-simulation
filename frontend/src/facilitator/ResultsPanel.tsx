import { Flag } from 'lucide-react'
import { useScoreboard } from '../api/hooks'
import type { SessionView } from '../api/types'
import { GroupedBars, type Series } from '../components/charts'
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
      <Card title="Scoreboard" subtitle="Normalized to each organization's own mandate" flush>
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
                  {d.scorecard.stars_start.toFixed(1)} → {d.scorecard.stars_year.toFixed(1)} →{' '}
                  {d.scorecard.stars_projected.toFixed(1)}{' '}
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
                        {f.split(':')[0].slice(0, 60)}
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
      <Card title="Dimension profile by team">
        <GroupedBars data={rows} series={series} format={(v) => v.toFixed(0)} />
      </Card>
      <div className="grid grid-3">
        {data.map((d) => (
          <Card
            key={d.team_id}
            title={d.team_name}
            subtitle={`Trap: ${d.trap_title}${d.scorecard.crisis_event ? ` · ${d.scorecard.crisis_event.toUpperCase()} ${d.scorecard.crisis_severity} (${d.scorecard.crisis_total ?? '—'}/18)` : ''}`}
          >
            <ul style={{ margin: 0, paddingLeft: 18 }} className="small secondary">
              {d.scorecard.dimensions.map((dim) => (
                <li key={dim.id}>
                  <strong>{dim.label}:</strong> {dim.drivers[0]}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}
