import { EyeOff, FileText } from 'lucide-react'
import { useAnswerKey } from '../api/hooks'
import type { SessionView } from '../api/types'
import { Card } from '../components/ui/Card'
import { Badge, Callout, Loading } from '../components/ui/primitives'

const list = (x: unknown) => (Array.isArray(x) ? (x as string[]) : [])

export function AnswerKeyPanel({ session, token }: { session: SessionView; token: string }) {
  const { data } = useAnswerKey(session.id, token)
  if (!data) return <Loading />
  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <Callout tone="warning" title="Facilitator only">
        <span className="row">
          <EyeOff size={14} aria-hidden /> Never project this screen. Teams discover these through
          evidence; reveal them in the debrief.
        </span>
      </Callout>
      {data.map((t) => {
        const team = session.teams.find((x) => x.team_id === t.team_id)
        return (
          <Card
            key={t.team_id}
            title={t.payer_name}
            subtitle={
              team
                ? `Root causes evidenced in Diagnose: ${team.root_causes_cited}/${team.root_causes_total}`
                : undefined
            }
          >
            <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
              <div className="grid grid-3">
                {t.hidden_root_causes.map((rc) => (
                  <div key={String(rc.id)} className="key-card">
                    <div className="row" style={{ '--gap': '6px' } as React.CSSProperties}>
                      <span className="code-chip code-chip--strong">{String(rc.id)}</span>
                      <span className="strong">{String(rc.title)}</span>
                    </div>
                    <p className="small secondary">{String(rc.description)}</p>
                    <p className="small">
                      <span className="upper muted">Review clue </span>
                      {String(rc.clue)}
                    </p>
                    <div className="chip-list">
                      {list(rc.evidence).map((a) => (
                        <Badge key={a} icon={<FileText aria-hidden />}>
                          {a}
                        </Badge>
                      ))}
                    </div>
                    <div className="xs muted">Addressed by {list(rc.addressed_by).join(', ')}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-2">
                {t.misleading_signals.map((m) => (
                  <Callout
                    key={String(m.id)}
                    tone="neutral"
                    title={`${String(m.id)} misleading signal — ${String(m.title)}`}
                  >
                    {String(m.why_misleading)}
                    <div className="xs muted" style={{ marginTop: 4 }}>
                      {list(m.evidence).join(' · ')}
                    </div>
                  </Callout>
                ))}
              </div>
              <Callout tone="critical" title={`Signature trap — ${t.trap_title}`}>
                {t.trap_description}
              </Callout>
              <div className="grid grid-2">
                <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
                  <span className="upper muted">Viable strategies</span>
                  {t.viable_strategies.map((s) => (
                    <div key={String(s.title)} className="key-card key-card--good">
                      <div className="strong small">
                        {String(s.title)}{' '}
                        <span className="muted">· {list(s.cards).join(', ')}</span>
                      </div>
                      <p className="xs secondary">{String(s.description)}</p>
                    </div>
                  ))}
                </div>
                <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
                  <span className="upper muted">Failure modes</span>
                  {t.failure_modes.map((f) => (
                    <div key={String(f.title)} className="key-card key-card--bad">
                      <div className="strong small">{String(f.title)}</div>
                      <p className="xs secondary">{String(f.description)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
