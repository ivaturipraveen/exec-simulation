import { FileDown, RefreshCw } from 'lucide-react'
import { useSessionPart } from '../api/hooks'
import type { PlaytestReport, SessionView } from '../api/types'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Badge, Callout, Loading, Stat } from '../components/ui/primitives'

const fmt = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 10) / 10}`)

/** T-094: stage time vs plan, team engagement and stalls, for comparing playtests. */
export function PlaytestCard({
  session,
  token,
  onDownload,
}: {
  session: SessionView
  token: string
  onDownload: () => void
}) {
  const { data, refetch, isFetching } = useSessionPart<PlaytestReport>(
    session.id,
    token,
    'playtest',
  )
  const actions = (
    <div className="row">
      <Button
        size="sm"
        variant="ghost"
        icon={<RefreshCw />}
        loading={isFetching}
        onClick={() => refetch()}
      >
        Refresh
      </Button>
      <Button size="sm" icon={<FileDown />} onClick={onDownload}>
        Report (.md)
      </Button>
    </div>
  )
  if (!data)
    return (
      <Card title="Playtest report" actions={actions}>
        <Loading />
      </Card>
    )
  const over = data.run_minutes - data.planned_minutes
  return (
    <Card
      title="Playtest report"
      subtitle={`Rebuilt from the event log · a team quiet for ${data.stall_minutes}+ minutes in a working stage is a stall`}
      actions={actions}
    >
      <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
        <div className="grid grid-4">
          <Stat
            label="Run time"
            value={`${fmt(data.run_minutes)} min`}
            meta={`${fmt(data.planned_minutes)} planned for stages reached`}
          />
          <Stat
            label="Against plan"
            value={`${over >= 0 ? '+' : ''}${fmt(over)} min`}
            meta={over > 0 ? 'Behind schedule' : 'On or ahead of schedule'}
          />
          <Stat label="Paused" value={`${fmt(data.paused_minutes)} min`} />
          <Stat
            label="Stalls"
            value={data.teams.reduce((n, t) => n + t.stalls.length, 0)}
            meta={`${data.observations.length} observations logged`}
          />
        </div>

        {data.findings.length > 0 ? (
          <Callout tone="warning" title="What to look at">
            <ul className="bullets">
              {data.findings.slice(0, 12).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Callout>
        ) : (
          <Callout tone="good">Nothing flagged so far.</Callout>
        )}

        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Stage</th>
                <th className="num">Planned (min)</th>
                <th className="num">Actual (min)</th>
                <th className="num">Difference (min)</th>
                <th style={{ width: '32%' }}>Planned vs actual</th>
              </tr>
            </thead>
            <tbody>
              {data.stages.map((s) => (
                <tr key={s.id} className={s.status === 'not_reached' ? 'muted' : undefined}>
                  <td className="small">
                    {s.title} {s.status === 'current' && <Badge tone="accent">now</Badge>}
                    {s.visits > 1 && <Badge outline>{s.visits}×</Badge>}
                  </td>
                  <td className="num small">{s.planned_minutes}</td>
                  <td className="num small">{s.visits ? fmt(s.actual_minutes) : '—'}</td>
                  <td className="num small">
                    {s.visits ? (
                      <Badge tone={s.overrun ? 'warning' : 'neutral'}>
                        {s.delta_minutes > 0 ? '+' : ''}
                        {fmt(s.delta_minutes)}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {(() => {
                      // Full-width track = the planned time; the fill is the share actually used.
                      // Smaller fills animate in faster, so a barely-used stage snaps in quickly.
                      const share = s.planned_minutes
                        ? Math.min(1, s.actual_minutes / s.planned_minutes)
                        : 0
                      const over = s.actual_minutes - s.planned_minutes
                      return (
                        <div
                          className="timing-track"
                          title={`${s.actual_minutes} of ${s.planned_minutes} planned minutes`}
                        >
                          <div className="timing-track__bar">
                            <span
                              className={`timing-track__fill ${over > 0.05 ? 'is-over' : ''}`}
                              style={
                                {
                                  '--fill': `${share * 100}%`,
                                  '--dur': `${250 + share * 900}ms`,
                                } as React.CSSProperties
                              }
                            />
                          </div>
                          <span className="timing-track__label">
                            {s.visits === 0
                              ? '—'
                              : over > 0.05
                                ? `+${over.toFixed(1)} min over`
                                : `${Math.round(share * 100)}%`}
                          </span>
                        </div>
                      )
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Team</th>
                <th className="num">Actions</th>
                <th className="num">AI questions</th>
                <th className="num">Artifacts</th>
                <th className="num">R1 submit</th>
                <th className="num">R2 submit</th>
                <th className="num">Longest quiet</th>
                <th>Forced</th>
              </tr>
            </thead>
            <tbody>
              {data.teams.map((t) => (
                <tr key={t.team_id}>
                  <td className="small">
                    <span className="strong">{t.team}</span>
                    {t.payer !== t.team && <div className="xs muted">{t.payer}</div>}
                  </td>
                  <td className="num small">{t.actions}</td>
                  <td className="num small">{t.ai_questions}</td>
                  <td className="num small">{t.artifacts_viewed}</td>
                  <td className="num small">
                    {t.round1_submit_minute == null ? '—' : `${fmt(t.round1_submit_minute)} min`}
                  </td>
                  <td className="num small">
                    {t.round2_submit_minute == null ? '—' : `${fmt(t.round2_submit_minute)} min`}
                  </td>
                  <td className="num small">
                    {t.stalls.length > 0 ? (
                      <Badge tone="warning">{fmt(t.longest_quiet_minutes)} min</Badge>
                    ) : (
                      `${fmt(t.longest_quiet_minutes)} min`
                    )}
                  </td>
                  <td className="small">{t.forced.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="xs muted" style={{ margin: 0 }}>
          Submit times are minutes after the round opened. Add notes during the session with the
          observation log; they appear in the downloaded report next to the stage they happened in.
        </p>
      </div>
    </Card>
  )
}
