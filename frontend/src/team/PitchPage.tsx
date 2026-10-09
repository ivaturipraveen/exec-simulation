import { Bot, FileText, Lock, Mic, Plus, Send, Timer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useCatalog, useDataRoom, useSavePitch } from '../api/hooks'
import type { PitchSubmission, TeamView } from '../api/types'
import { RubricView } from '../components/RubricView'
import { StageBanner } from '../components/StageBanner'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Dialog } from '../components/ui/Dialog'
import { Field, Textarea } from '../components/ui/Field'
import { Badge, Callout, Empty, Loading, PageHeader } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'
import { money } from '../lib/format'
import { useDebouncedEffect } from '../lib/useDebouncedEffect'

const FIELDS: {
  key: keyof Omit<PitchSubmission, 'evidence'>
  label: string
  hint: string
  rows: number
}[] = [
  {
    key: 'results',
    label: 'What Round 1 produced',
    hint: 'Cite your Year 1 results: leading KPIs, not just Stars.',
    rows: 2,
  },
  {
    key: 'causal',
    label: 'Why it differed from your thesis',
    hint: 'Explain it in terms of the causal chain.',
    rows: 3,
  },
  {
    key: 'decision',
    label: 'What you will scale, modify, pause or cancel',
    hint: 'Name the card and the reason.',
    rows: 2,
  },
  {
    key: 'risk',
    label: 'A risk your portfolio creates, and its control',
    hint: 'Specific risk plus a specific control.',
    rows: 2,
  },
  { key: 'ask', label: 'The ask', hint: 'One sentence a board member could repeat.', rows: 1 },
]

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

export function PitchPage({ team }: { team: TeamView }) {
  const { data: catalog } = useCatalog()
  const { data: room } = useDataRoom()
  const ws = team.workspace
  const editable = team.flags.can_edit_pitch
  const [pitch, setPitch] = useState<PitchSubmission>(ws.pitch)
  const [figures, setFigures] = useState<string[]>(ws.pitch_figures)
  const [picking, setPicking] = useState(false)
  const save = useSavePitch()
  const toast = useToast()
  const navigate = useNavigate()
  const titles = useMemo(() => new Map((room ?? []).map((a) => [a.id, a.title])), [room])

  const total = FIELDS.reduce((n, f) => n + words(pitch[f.key] ?? ''), 0)
  const limit = team.rules.pitch_word_limit
  const seconds = Math.round(total / team.rules.pitch_words_per_second)

  useDebouncedEffect(() => {
    if (!editable || ws.pitch_submitted_at) return
    save.mutate({ pitch, submit: false }, { onSuccess: (r) => setFigures(r.unsupported_figures) })
  }, [pitch])

  if (!catalog) return <Loading />
  if (team.flags.results_years.length < 1) {
    return (
      <Empty title="The board pitch opens after Year 1" icon={<Lock aria-hidden />}>
        After the Year 1 performance review, each team gives a 90-second pitch. The rubric sets how
        much Round 2 capital you earn on top of the {money(team.rules.round2_base_musd)} base.
      </Empty>
    )
  }

  const tiers = team.rules.pitch_capital
  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <PageHeader
        eyebrow="Investment Round 2"
        title="90-second board pitch"
        description="The board funds learning, not loyalty to last year's projects. Every figure must be traceable to your data room or results."
        actions={
          <Button
            variant="secondary"
            icon={<Bot />}
            onClick={() =>
              navigate('/team/analyst', {
                state: {
                  mode: 'pitch',
                  context:
                    FIELDS.map((f) => `${f.label}: ${pitch[f.key]}`).join('\n') +
                    `\nEvidence: ${pitch.evidence.join(', ')}`,
                },
              })
            }
          >
            Rehearse with the pitch coach
          </Button>
        }
      />
      <StageBanner team={team} compact />
      <div className="grid grid-split">
        <Card
          title="Your pitch"
          actions={
            <Badge
              tone={total > limit ? 'warning' : 'neutral'}
              icon={<Timer size={12} aria-hidden />}
            >
              {total} words · about {seconds}s
            </Badge>
          }
        >
          <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
            <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
              <span className="field__label">Evidence cited (data-room artifacts)</span>
              <div className="chip-list">
                {pitch.evidence.map((a) => (
                  <Badge key={a} tone="accent" icon={<FileText aria-hidden />}>
                    {a} {titles.get(a) ? `· ${titles.get(a)}` : ''}
                  </Badge>
                ))}
                {editable && !ws.pitch_submitted_at && (
                  <Button size="sm" icon={<Plus />} onClick={() => setPicking(true)}>
                    Cite artifacts
                  </Button>
                )}
              </div>
            </div>
            {FIELDS.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                {(id) => (
                  <Textarea
                    id={id}
                    rows={f.rows}
                    style={f.rows === 1 ? { minHeight: 44 } : undefined}
                    value={pitch[f.key] ?? ''}
                    disabled={!editable || !!ws.pitch_submitted_at}
                    maxLength={1500}
                    onChange={(e) => setPitch((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                )}
              </Field>
            ))}
            {figures.length > 0 && (
              <Callout tone="warning" title="Figures we cannot trace to your data room or results">
                {figures.join(', ')} — a board member will ask where these came from. Remove them or
                cite the source.
              </Callout>
            )}
            {ws.pitch_submitted_at ? (
              <Callout tone="good" title="Pitch submitted">
                Deliver it out loud in 90 seconds. The facilitator scores it on the rubric.
              </Callout>
            ) : (
              <Button
                variant="primary"
                icon={<Send />}
                disabled={!editable || total === 0}
                loading={save.isPending}
                onClick={async () => {
                  try {
                    const r = await save.mutateAsync({ pitch, submit: true })
                    setFigures(r.unsupported_figures)
                    toast('Pitch submitted')
                  } catch (e) {
                    toast(errorMessage(e), 'error')
                  }
                }}
              >
                Submit pitch for scoring
              </Button>
            )}
          </div>
        </Card>
        <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
          {ws.pitch_score ? (
            <Card title="Board score" subtitle="Facilitator decision">
              <RubricView rows={catalog.rubrics.pitch} score={ws.pitch_score} />
            </Card>
          ) : (
            <Card title="How the board scores you" subtitle="Five rows, 0 to 3 each — 15 maximum">
              <ul className="list-reset stack" style={{ '--gap': '10px' } as React.CSSProperties}>
                {catalog.rubrics.pitch.map((r) => (
                  <li key={r.id}>
                    <div className="strong small">{r.criterion}</div>
                    <div className="xs secondary">{r.good_answer}</div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card
            title="Earned Round 2 capital"
            subtitle={`Added to the ${money(team.rules.round2_base_musd)} base`}
          >
            <table className="table table--compact">
              <tbody>
                {tiers.map((t, i) => (
                  <tr
                    key={t.min_score}
                    className={
                      ws.pitch_score &&
                      ws.pitch_score.total >= t.min_score &&
                      (i === 0 || ws.pitch_score.total < tiers[i - 1].min_score)
                        ? 'is-highlight'
                        : ''
                    }
                  >
                    <td>
                      {i === 0
                        ? `${t.min_score} to 15`
                        : `${t.min_score} to ${tiers[i - 1].min_score - 1}`}
                    </td>
                    <td className="num strong">+{money(t.earned_musd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Callout tone="accent" title="Delivery tips">
            <Mic size={13} aria-hidden /> Results → why → decision → risk and control → the ask.
            Stop at 90 seconds.
          </Callout>
        </div>
      </div>
      <Dialog
        open={picking}
        onClose={() => setPicking(false)}
        title="Cite data-room artifacts"
        wide
        footer={
          <Button variant="primary" onClick={() => setPicking(false)}>
            Done
          </Button>
        }
      >
        <ul className="list-reset stack" style={{ '--gap': '6px' } as React.CSSProperties}>
          {(room ?? []).map((a) => {
            const checked = pitch.evidence.includes(a.id)
            return (
              <li key={a.id}>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setPitch((p) => ({
                        ...p,
                        evidence: checked
                          ? p.evidence.filter((x) => x !== a.id)
                          : [...p.evidence, a.id].slice(0, 12),
                      }))
                    }
                  />
                  <span>
                    <span className="code-chip">{a.id}</span> {a.title}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </Dialog>
    </div>
  )
}
