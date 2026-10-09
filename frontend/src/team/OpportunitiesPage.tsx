import { MessageSquareHeart, Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { errorMessage } from '../api/client'
import { useCatalog, useSaveOpportunities, useSubmitFeedback } from '../api/hooks'
import type { FeedbackBody, Opportunity, TeamView } from '../api/types'
import { OpportunityMatrix } from '../components/OpportunityMatrix'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Dialog } from '../components/ui/Dialog'
import { Field, Input, Segmented, Select, Textarea } from '../components/ui/Field'
import { Callout, Empty, PageHeader } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'
import { storage } from '../lib/storage'

const scale = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }))

export function OpportunitiesPage({ team }: { team: TeamView }) {
  const { data: catalog } = useCatalog()
  const save = useSaveOpportunities()
  const toast = useToast()
  const ws = team.workspace
  const [participant, setParticipant] = useState(() => storage.get('execsim.participant') ?? '')
  const [items, setItems] = useState<Opportunity[]>(ws.opportunities)
  const [consent, setConsent] = useState(ws.consent?.granted ?? false)
  const [draft, setDraft] = useState<Opportunity | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  if (!team.flags.can_capture_opportunities) {
    return (
      <Empty title="Opens at Final results">
        Each participant captures 2 to 3 opportunities for their real organization.
      </Empty>
    )
  }

  const persist = async (next: Opportunity[], nextConsent = consent) => {
    try {
      await save.mutateAsync({
        items: next,
        consent: { granted: nextConsent, participant, at: new Date().toISOString() },
      })
      toast('Opportunity map saved')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const avg = (o: Opportunity) => {
    const r = o.readiness ?? { data: 3, workflow: 3, owner: 3, controls: 3 }
    return ((r.data ?? 3) + (r.workflow ?? 3) + (r.owner ?? 3) + (r.controls ?? 3)) / 4
  }
  const newDraft = (): Opportunity => ({
    id: crypto.randomUUID().slice(0, 12),
    participant,
    title: '',
    capability_class: catalog?.opportunity.capability_classes[0] ?? 'Predictive',
    value_hypothesis: '',
    value: 3,
    readiness: { data: 3, workflow: 3, owner: 3, controls: 3 },
    dependencies: '',
    risks: '',
    owner: '',
    next_step: '',
    foundations: [],
  })

  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <PageHeader
        eyebrow="Real-company translation"
        title="AI Opportunity Map"
        description="Where could these capabilities create value in your organization, what prevents action today, and what can move in the next 90 days?"
        actions={
          <>
            <Button icon={<MessageSquareHeart />} onClick={() => setFeedbackOpen(true)}>
              Session feedback
            </Button>
            <Button
              variant="primary"
              icon={<Plus />}
              disabled={!participant.trim()}
              onClick={() => setDraft(newDraft())}
            >
              Add opportunity
            </Button>
          </>
        }
      />
      <Card>
        <div className="grid grid-2" style={{ alignItems: 'end' }}>
          <Field label="Your name" hint="Used to attribute your opportunities (aim for 2–3 each).">
            {(id) => (
              <Input
                id={id}
                value={participant}
                maxLength={80}
                onChange={(e) => {
                  setParticipant(e.target.value)
                  storage.set('execsim.participant', e.target.value)
                }}
              />
            )}
          </Field>
          <label className="checkbox small">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked)
                persist(items, e.target.checked)
              }}
            />
            {catalog?.opportunity.consent_text ??
              'I consent to this opportunity being stored and shared with the organization map.'}
          </label>
        </div>
      </Card>
      <div className="grid grid-split">
        <Card title="Your team's map">
          <OpportunityMatrix
            themes={catalog?.opportunity.foundational_themes}
            minLinks={catalog?.opportunity.foundational_min_links}
            valueCut={catalog?.opportunity.act_now_value}
            readinessCut={catalog?.opportunity.act_now_readiness}
            items={items.map((o) => ({
              id: o.id ?? o.title,
              title: o.title,
              value: o.value,
              readiness: avg(o),
              foundations: o.foundations,
              meta: `${o.participant} · first 90 days: ${o.next_step || 'tbd'}`,
            }))}
          />
        </Card>
        <Card title="Opportunities" subtitle={`${items.length} captured`} flush>
          {items.length === 0 ? (
            <Empty title="Nothing captured yet">
              Add your first opportunity — value hypothesis, readiness, dependencies, risks, owner
              and a 90-day step.
            </Empty>
          ) : (
            <ul className="list-reset">
              {items.map((o) => (
                <li
                  key={o.id}
                  className="row"
                  style={{
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--border)',
                    alignItems: 'flex-start',
                  }}
                >
                  <div className="grow">
                    <div className="strong">{o.title}</div>
                    <div className="xs muted">
                      {o.participant} · {o.capability_class} · value {o.value}/5 · readiness{' '}
                      {avg(o).toFixed(1)}/5
                    </div>
                    {o.next_step && (
                      <div className="small secondary" style={{ marginTop: 4 }}>
                        90 days: {o.next_step}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    icon={<Trash2 />}
                    aria-label={`Delete ${o.title}`}
                    onClick={() => {
                      const next = items.filter((x) => x.id !== o.id)
                      setItems(next)
                      persist(next)
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Callout tone="neutral">
        Follow-on support (assessment → roadmap → pilot) is optional diligence, not a predetermined
        conclusion.
      </Callout>

      <Dialog
        open={!!draft}
        onClose={() => setDraft(null)}
        title="New opportunity"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={<Save />}
              disabled={!draft?.title.trim()}
              loading={save.isPending}
              onClick={async () => {
                if (!draft) return
                const next = [...items, { ...draft, participant }]
                setItems(next)
                await persist(next)
                setDraft(null)
              }}
            >
              Save opportunity
            </Button>
          </>
        }
      >
        {draft && (
          <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
            <div className="grid grid-2">
              <Field label="Opportunity">
                {(id) => (
                  <Input
                    id={id}
                    value={draft.title}
                    maxLength={200}
                    autoFocus
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="e.g. Predictive adherence for our dual-eligible members"
                  />
                )}
              </Field>
              <Field label="Capability class">
                {(id) => (
                  <Select
                    id={id}
                    value={draft.capability_class}
                    onChange={(e) => setDraft({ ...draft, capability_class: e.target.value })}
                  >
                    {(catalog?.opportunity.capability_classes ?? []).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Field label="Value hypothesis" hint="What moves, by how much, for whom.">
              {(id) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={draft.value_hypothesis ?? ''}
                  maxLength={2000}
                  onChange={(e) => setDraft({ ...draft, value_hypothesis: e.target.value })}
                />
              )}
            </Field>
            <div className="field">
              <span className="field__label">Value (1–5)</span>
              <Segmented
                label="Value"
                value={draft.value}
                options={scale}
                onChange={(v) => setDraft({ ...draft, value: v })}
              />
            </div>
            <div className="grid grid-2">
              {(['data', 'workflow', 'owner', 'controls'] as const).map((k) => (
                <div key={k} className="field">
                  <span className="field__label">Readiness: {k} (1–5)</span>
                  <Segmented
                    label={`Readiness ${k}`}
                    value={draft.readiness?.[k] ?? 3}
                    options={scale}
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        readiness: { ...draft.readiness, [k]: v },
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-2">
              <Field label="Dependencies">
                {(id) => (
                  <Textarea
                    id={id}
                    rows={2}
                    value={draft.dependencies ?? ''}
                    onChange={(e) => setDraft({ ...draft, dependencies: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Risks">
                {(id) => (
                  <Textarea
                    id={id}
                    rows={2}
                    value={draft.risks ?? ''}
                    onChange={(e) => setDraft({ ...draft, risks: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Owner">
                {(id) => (
                  <Input
                    id={id}
                    value={draft.owner ?? ''}
                    maxLength={200}
                    onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
                  />
                )}
              </Field>
              <Field label="First 90-day step">
                {(id) => (
                  <Input
                    id={id}
                    value={draft.next_step ?? ''}
                    onChange={(e) => setDraft({ ...draft, next_step: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <div className="field">
              <span className="field__label">Depends on these foundations</span>
              <div className="chip-list">
                {(catalog?.opportunity.foundational_themes ?? []).map((t) => {
                  const on = (draft.foundations ?? []).includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`chip ${on ? 'chip--on' : ''}`}
                      aria-pressed={on}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          foundations: on
                            ? (draft.foundations ?? []).filter((x) => x !== t)
                            : [...(draft.foundations ?? []), t],
                        })
                      }
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </Dialog>
      <FeedbackDialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        participant={participant}
      />
    </div>
  )
}

function FeedbackDialog({
  open,
  onClose,
  participant,
}: {
  open: boolean
  onClose: () => void
  participant: string
}) {
  const submit = useSubmitFeedback()
  const toast = useToast()
  const [f, setF] = useState<FeedbackBody>({
    participant,
    learning: 4,
    judgment_changed: true,
    usefulness_vs_presentation: 4,
    realism: 4,
    would_recommend: 8,
    comments: '',
  })
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="How was this session?"
      subtitle="Anonymous to other teams; used to improve the simulation."
      footer={
        <Button
          variant="primary"
          loading={submit.isPending}
          onClick={async () => {
            try {
              await submit.mutateAsync({ ...f, participant })
              toast('Thank you for your feedback')
              onClose()
            } catch (e) {
              toast(errorMessage(e), 'error')
            }
          }}
        >
          Submit feedback
        </Button>
      }
    >
      <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
        {(
          [
            ['learning', 'I can explain how AI investments flow through workflow, KPIs and Stars'],
            [
              'usefulness_vs_presentation',
              'More useful than a conventional executive AI presentation',
            ],
            ['realism', 'Medicare Advantage context felt realistic'],
          ] as const
        ).map(([k, label]) => (
          <div key={k} className="field">
            <span className="field__label">{label}</span>
            <Segmented
              label={label}
              value={f[k]}
              options={scale}
              onChange={(v) => setF({ ...f, [k]: v })}
            />
          </div>
        ))}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={f.judgment_changed}
            onChange={(e) => setF({ ...f, judgment_changed: e.target.checked })}
          />{' '}
          Evidence changed at least one of our investment or control decisions
        </label>
        <Field label="How likely are you to recommend this (0–10)?">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={0}
              max={10}
              value={f.would_recommend}
              onChange={(e) =>
                setF({ ...f, would_recommend: Math.max(0, Math.min(10, Number(e.target.value))) })
              }
            />
          )}
        </Field>
        <Field label="Comments">
          {(id) => (
            <Textarea
              id={id}
              value={f.comments ?? ''}
              onChange={(e) => setF({ ...f, comments: e.target.value })}
            />
          )}
        </Field>
      </div>
    </Dialog>
  )
}
