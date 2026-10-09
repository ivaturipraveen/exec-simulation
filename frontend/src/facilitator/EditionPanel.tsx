import { AlertTriangle, BookOpen, ClipboardCheck, Scissors, Siren, Workflow } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCatalog, useEdition } from '../api/hooks'
import type { SessionView } from '../api/types'
import { Card } from '../components/ui/Card'
import { Badge, Callout, Loading } from '../components/ui/primitives'

/** The content edition: assumptions log, simplification register, design warnings and triggers. */
export function EditionPanel({ session, token }: { session: SessionView; token: string }) {
  const { data } = useEdition(session.id, token)
  const { data: catalog } = useCatalog()
  if (!data || !catalog) return <Loading />
  const review = (data.review ?? []) as {
    id: string
    kind: string
    section: string
    text: string
    status: string
    note?: string
  }[]
  const status = new Map(review.map((r) => [r.id, r]))
  const open = review.filter((r) => r.status === 'open').length
  const tone = (st?: string) =>
    (st === 'confirmed' ? 'good' : st === 'changed' ? 'accent' : 'neutral') as
      'good' | 'accent' | 'neutral'
  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <Callout tone="accent" title={`${data.content_pack} · content v${data.content_version}`}>
        Every number is an assumption until the content owner confirms it. Session mode:{' '}
        {session.sim_mode}; Round 2: {session.round2_mechanic}; seed {session.seed}.
      </Callout>
      {data.warnings.length > 0 && (
        <Callout tone="warning" title="Content design warnings">
          <ul className="bullets">
            {data.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Callout>
      )}
      <Card
        title={
          <span className="row">
            <Siren size={16} aria-hidden /> Crisis triggers
          </span>
        }
        subtitle="The engine recommends; you confirm or override with a note"
        flush
      >
        <table className="table">
          <tbody>
            {data.events.map((e) => (
              <tr key={e.id}>
                <td style={{ width: '32%' }}>
                  <span className="code-chip code-chip--strong">{e.code}</span>{' '}
                  <span className="strong">{e.title}</span>
                  <div className="xs muted">
                    {e.payer_ids.length ? e.payer_ids.join(', ') : 'Cross-cutting'} · {e.minutes}{' '}
                    min · {e.severities.join(' / ')}
                  </div>
                </td>
                <td className="small secondary">{e.trigger_text}</td>
                <td className="small" style={{ width: '24%' }}>
                  {e.leadership_test}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="grid grid-2">
        <Card
          title={
            <span className="row">
              <Scissors size={16} aria-hidden /> Contingency cuts
            </span>
          }
          flush
        >
          <table className="table table--compact">
            <tbody>
              {data.contingency_cuts.map((c) => (
                <tr key={String(c.id)}>
                  <td className="small strong" style={{ width: '38%' }}>
                    {String(c.condition)}
                  </td>
                  <td className="small secondary">{String(c.cut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card
          title={
            <span className="row">
              <Workflow size={16} aria-hidden /> Operating model: facilitator notes
            </span>
          }
          flush
        >
          <table className="table table--compact">
            <tbody>
              {catalog.workflow_steps.map((s) => (
                <tr key={s.id}>
                  <td className="small strong" style={{ width: '34%' }}>
                    {s.number}. {s.name}
                  </td>
                  <td className="small secondary">{data.workflow_notes[s.id]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      {review.length > 0 && (
        <Card
          title={
            <span className="row">
              <ClipboardCheck size={16} aria-hidden /> Content review sign-off (pack §12)
            </span>
          }
          subtitle={`${review.length - open} of ${review.length} items confirmed or changed · edit in Settings → Content review`}
          actions={
            <Link to="/settings" className="btn btn--ghost btn--sm">
              Open Settings
            </Link>
          }
          flush
        >
          <table className="table table--compact">
            <tbody>
              {review
                .filter((r) => r.kind === 'checklist')
                .map((r) => (
                  <tr key={r.id}>
                    <td style={{ width: 70 }}>
                      <Badge outline>{r.id}</Badge>
                    </td>
                    <td className="small secondary">
                      <span className="strong">{r.section}</span> · {r.text}
                      {r.note && <div className="xs muted">Note: {r.note}</div>}
                    </td>
                    <td style={{ width: 110 }}>
                      <Badge tone={tone(r.status)}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      )}
      <Card
        title={
          <span className="row">
            <BookOpen size={16} aria-hidden /> Assumptions log
          </span>
        }
        subtitle="Open decisions resolved for this edition; B-rows are build assumptions for review"
        flush
      >
        <table className="table table--compact">
          <tbody>
            {data.assumptions.map((a) => (
              <tr key={String(a.id)}>
                <td style={{ width: 70 }}>
                  <Badge tone={String(a.id).startsWith('B') ? 'warning' : 'neutral'}>
                    {String(a.id)}
                  </Badge>
                </td>
                <td className="small strong" style={{ width: '22%' }}>
                  {String(a.decision)}
                </td>
                <td className="small secondary">{String(a.assumption)}</td>
                <td style={{ width: 110 }}>
                  {status.get(String(a.id)) && (
                    <Badge tone={tone(status.get(String(a.id))?.status)}>
                      {status.get(String(a.id))?.status}
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card
        title={
          <span className="row">
            <AlertTriangle size={16} aria-hidden /> Simplification register
          </span>
        }
        subtitle="Say these lines in the debrief"
        flush
      >
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Actual concept</th>
              <th>V1 representation</th>
              <th>Risk of misunderstanding</th>
              <th>Facilitator disclosure</th>
            </tr>
          </thead>
          <tbody>
            {data.simplifications.map((s) => (
              <tr key={s.actual}>
                <td className="small">{s.actual}</td>
                <td className="small secondary">{s.representation}</td>
                <td className="small secondary">{s.risk}</td>
                <td className="small">“{s.disclosure}”</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
