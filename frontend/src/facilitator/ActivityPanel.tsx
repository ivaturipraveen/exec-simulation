import { Download, FileDown } from 'lucide-react'
import { useEvents, useSessionPart } from '../api/hooks'
import { errorMessage } from '../api/client'
import type { FeedbackSummary, SessionView } from '../api/types'
import { Button } from '../components/ui/Button'
import { SectionTabs } from '../components/SectionTabs'
import { Card } from '../components/ui/Card'
import { Badge, Loading, Stat } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'
import { downloadText } from '../lib/download'
import { PlaytestCard } from './PlaytestCard'

/** Event payload as readable text: "action: next · stage: translate". */
function detailText(payload: unknown): string {
  if (payload == null || typeof payload !== 'object') return payload == null ? '—' : String(payload)
  const parts = Object.entries(payload as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v)
      return `${k.replace(/_/g, ' ')}: ${val.replace(/_/g, ' ')}`
    })
  return parts.length ? parts.join(' · ') : '—'
}

export function ActivityPanel({ session, token }: { session: SessionView; token: string }) {
  const { data } = useEvents(session.id, token)
  const toast = useToast()
  const names = new Map(session.teams.map((t) => [t.team_id, t.team_name]))
  const dl = (path: string, file: string, type: string) =>
    downloadText(`/sessions/${session.id}${path}`, token, file, type).catch((e) =>
      toast(errorMessage(e), 'error'),
    )
  const { data: fb } = useSessionPart<FeedbackSummary>(session.id, token, 'feedback')
  const pct = (x?: number | null) => (x == null ? '—' : `${Math.round(x * 100)}%`)
  const tg = session.rules.pilot_targets as {
    learning: number
    judgment_changed: number
    usefulness: number
  }
  const hit = (x: number | null | undefined, target: number) =>
    x == null ? null : x >= target ? (
      <Badge tone="good">meets target</Badge>
    ) : (
      <Badge tone="warning">below target</Badge>
    )
  return (
    <SectionTabs
      label="Activity sections"
      sections={[
        {
          id: 'activity',
          label: 'Activity log',
          count: data?.length,
          content: (
            <Card
              title="Activity"
              subtitle="Questions, evidence, decisions, revisions and facilitator interventions"
              flush
            >
              {!data ? (
                <Loading />
              ) : (
                <div className="table-wrap" style={{ maxHeight: '60vh' }}>
                  <table className="table table--compact activity-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Team</th>
                        <th>Actor</th>
                        <th>Event</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data]
                        .reverse()
                        .slice(0, 400)
                        .map((e) => (
                          <tr key={e.id}>
                            <td className="activity__time">
                              {new Date(e.created_at).toLocaleTimeString()}
                            </td>
                            <td className="small">
                              {e.team_id ? (names.get(e.team_id) ?? e.team_id) : '—'}
                            </td>
                            <td className="small muted">{e.actor}</td>
                            <td className="small strong">{e.kind.replace(/_/g, ' ')}</td>
                            <td className="activity__detail">{detailText(e.payload)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ),
        },
        {
          id: 'exports',
          label: 'Exports',
          content: (
            <Card
              title="Exports"
              subtitle="Executive summary, AI Opportunity Map and the full learning-evidence log"
            >
              <div className="row wrap">
                <Button
                  variant="primary"
                  icon={<FileDown />}
                  onClick={() =>
                    dl('/summary.md', `session-${session.id}-summary.md`, 'text/markdown')
                  }
                >
                  Executive summary (.md)
                </Button>
                <Button
                  icon={<Download />}
                  onClick={() => dl('/events.csv', `session-${session.id}-events.csv`, 'text/csv')}
                >
                  Event log (.csv)
                </Button>
              </div>
            </Card>
          ),
        },
        {
          id: 'playtest',
          label: 'Playtest report',
          content: (
            <PlaytestCard
              session={session}
              token={token}
              onDownload={() =>
                dl('/playtest.md', `session-${session.id}-playtest.md`, 'text/markdown')
              }
            />
          ),
        },
        {
          id: 'pilot',
          label: 'Pilot indicators',
          count: fb?.responses ?? 0,
          content: (
            <Card
              title="Pilot success indicators"
              subtitle={`From participant feedback · ${fb?.responses ?? 0} responses`}
            >
              <div className="grid grid-4">
                <Stat
                  label="Learning (rated 4–5)"
                  value={pct(fb?.learning_4plus_pct)}
                  meta={
                    <>
                      Target ≥ {pct(tg.learning)} {hit(fb?.learning_4plus_pct, tg.learning)}
                    </>
                  }
                />
                <Stat
                  label="Changed a decision on evidence"
                  value={pct(fb?.judgment_changed_pct)}
                  meta={
                    <>
                      Target ≥ {pct(tg.judgment_changed)}{' '}
                      {hit(fb?.judgment_changed_pct, tg.judgment_changed)}
                    </>
                  }
                />
                <Stat
                  label="More useful than a presentation"
                  value={pct(fb?.usefulness_4plus_pct)}
                  meta={
                    <>
                      Target ≥ {pct(tg.usefulness)} {hit(fb?.usefulness_4plus_pct, tg.usefulness)}
                    </>
                  }
                />
                <Stat
                  label="Realism (avg of 5)"
                  value={fb?.realism_avg?.toFixed(1) ?? '—'}
                  meta={`Recommend: ${fb?.recommend_avg?.toFixed(1) ?? '—'} / 10`}
                />
              </div>
            </Card>
          ),
        },
      ]}
    />
  )
}
