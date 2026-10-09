import { Send, Siren, Timer } from 'lucide-react'
import { useState } from 'react'
import { errorMessage } from '../api/client'
import { useCatalog, useCrisis, useRespondCrisis } from '../api/hooks'
import type { CrisisResponse, TeamView } from '../api/types'
import { RubricView } from '../components/RubricView'
import { StageBanner } from '../components/StageBanner'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Field, Input, Textarea } from '../components/ui/Field'
import { Badge, Callout, Empty, Loading, PageHeader } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'
import { clockText } from '../lib/format'
import { useSecondsUntil } from '../lib/useRemaining'

const DECISIONS = [
  ['pause', 'Pause the capability while we investigate'],
  ['continue_with_controls', 'Continue with added controls'],
  ['shut_down', 'Shut it down'],
  ['continue', 'Continue unchanged'],
] as const
const DISCLOSURE = [
  ['immediate', 'Disclose now, members first'],
  ['after_investigation', 'Disclose after the investigation'],
  ['none', 'Do not disclose'],
] as const
const STAKEHOLDERS = ['members', 'providers', 'regulator', 'board', 'press', 'staff'] as const

const blank: CrisisResponse = {
  decision: 'pause',
  restart_criteria: '',
  owner: '',
  operational_lead: '',
  authority: '',
  investigation: '',
  hypotheses: '',
  stakeholders: [],
  disclosure: 'immediate',
  communication: '',
  protection: '',
  resources: '',
  corrective_action: '',
  monitoring: '',
}

const SEVERITY_TONE = { high: 'critical', medium: 'warning', low: 'neutral' } as const

export function CrisisPage({ team }: { team: TeamView }) {
  const assigned = !!team.workspace.crisis_event_id
  const { data, isPending } = useCrisis(assigned)
  const { data: catalog } = useCatalog()
  const respond = useRespondCrisis()
  const toast = useToast()
  const [form, setForm] = useState<CrisisResponse>(blank)
  const deadline = data?.assigned_at
    ? new Date(data.assigned_at).getTime() + data.minutes * 60_000
    : null
  const remaining = useSecondsUntil(deadline)
  if (!assigned)
    return (
      <Empty title="No crisis yet" icon={<Siren aria-hidden />}>
        The facilitator releases a crisis during the Crisis stage. Which one depends on the choices
        your team made.
      </Empty>
    )
  if (isPending || !data || !catalog) return <Loading />
  const set = <K extends keyof CrisisResponse>(k: K, v: CrisisResponse[K]) =>
    setForm((f) => ({ ...f, [k]: v }))
  const rubric = new Map(catalog.rubrics.crisis.map((r) => [r.id, r]))
  const hint = (id: string) => rubric.get(id)?.good_answer

  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <PageHeader
        eyebrow={`Crisis ${data.code}`}
        title={data.title}
        description="The information is incomplete by design. Decide containment, ownership, investigation, communication, protection and durable remediation. Concealment and cosmetic communications score zero."
        actions={
          <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
            {data.severity && (
              <Badge
                tone={SEVERITY_TONE[data.severity as keyof typeof SEVERITY_TONE]}
                icon={<Siren aria-hidden />}
              >
                {data.severity} severity
              </Badge>
            )}
            {!data.score && remaining != null && (
              <Badge tone={remaining < 120 ? 'critical' : 'neutral'} icon={<Timer aria-hidden />}>
                {clockText(remaining)} left
              </Badge>
            )}
          </div>
        }
      />
      <StageBanner team={team} compact />
      <div className="packet" role="note" aria-label="Crisis packet">
        <span className="packet__label">Read to the team · {data.minutes} minutes</span>
        <p>{data.packet}</p>
      </div>

      {data.score ? (
        <div className="grid grid-split">
          <Card
            title="Response score"
            subtitle={`Six rows, 0 to 3 each — 18 maximum. Under ${team.rules.critical_crisis_threshold} is a critical incident (−${team.rules.critical_incident_penalty} points).`}
          >
            <RubricView rows={catalog.rubrics.crisis} score={data.score} />
          </Card>
          <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
            {data.severity_description && (
              <Callout tone="critical" title="What actually happened">
                {data.severity_description}
              </Callout>
            )}
            {data.effect_text && (
              <Callout tone="warning" title="Effect on the simulation">
                {data.effect_text}
              </Callout>
            )}
            {data.best_practice && (
              <Card
                title="What strong leadership looked like"
                subtitle={data.leadership_test ?? undefined}
              >
                <ul className="bullets secondary">
                  {data.best_practice.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <form
          className="stack"
          style={{ '--gap': '16px' } as React.CSSProperties}
          onSubmit={async (e) => {
            e.preventDefault()
            try {
              await respond.mutateAsync(form)
              toast('Response submitted')
            } catch (err) {
              toast(errorMessage(err), 'error')
            }
          }}
        >
          <div className="grid grid-2">
            <Card title="1 · Stop or continue" subtitle={hint('stop_continue')}>
              <fieldset className="radio-group">
                <legend className="sr-only">Decision</legend>
                {DECISIONS.map(([v, l]) => (
                  <label key={v} className="checkbox">
                    <input
                      type="radio"
                      name="decision"
                      checked={form.decision === v}
                      onChange={() => set('decision', v)}
                    />{' '}
                    {l}
                  </label>
                ))}
              </fieldset>
              <Field label="Criteria for restart">
                {(id) => (
                  <Textarea
                    id={id}
                    rows={2}
                    value={form.restart_criteria}
                    maxLength={1500}
                    onChange={(e) => set('restart_criteria', e.target.value)}
                  />
                )}
              </Field>
            </Card>
            <Card title="2 · Owner" subtitle={hint('owner')}>
              <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
                <Field label="Accountable executive (one person)">
                  {(id) => (
                    <Input
                      id={id}
                      required
                      value={form.owner}
                      maxLength={200}
                      onChange={(e) => set('owner', e.target.value)}
                      placeholder="Name and title"
                    />
                  )}
                </Field>
                <Field label="Operational lead">
                  {(id) => (
                    <Input
                      id={id}
                      value={form.operational_lead}
                      maxLength={200}
                      onChange={(e) => set('operational_lead', e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Authority to act">
                  {(id) => (
                    <Input
                      id={id}
                      value={form.authority}
                      maxLength={1000}
                      onChange={(e) => set('authority', e.target.value)}
                      placeholder="What can they stop, spend or decide?"
                    />
                  )}
                </Field>
              </div>
            </Card>
            <Card title="3 · Investigation" subtitle={hint('investigation')}>
              <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
                <Field label="What you verify first and how (scope, data, timeline)">
                  {(id) => (
                    <Textarea
                      id={id}
                      value={form.investigation}
                      maxLength={2000}
                      onChange={(e) => set('investigation', e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Working hypotheses">
                  {(id) => (
                    <Textarea
                      id={id}
                      rows={2}
                      value={form.hypotheses}
                      maxLength={1500}
                      onChange={(e) => set('hypotheses', e.target.value)}
                    />
                  )}
                </Field>
              </div>
            </Card>
            <Card title="4 · Stakeholder communication" subtitle={hint('communication')}>
              <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
                <div className="chip-list" role="group" aria-label="Who hears">
                  {STAKEHOLDERS.map((s) => {
                    const on = form.stakeholders.includes(s)
                    return (
                      <button
                        key={s}
                        type="button"
                        className={`chip ${on ? 'chip--on' : ''}`}
                        aria-pressed={on}
                        onClick={() =>
                          set(
                            'stakeholders',
                            on
                              ? form.stakeholders.filter((x) => x !== s)
                              : [...form.stakeholders, s],
                          )
                        }
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
                <fieldset className="radio-group">
                  <legend className="field__label">Disclosure</legend>
                  {DISCLOSURE.map(([v, l]) => (
                    <label key={v} className="checkbox">
                      <input
                        type="radio"
                        name="disclosure"
                        checked={form.disclosure === v}
                        onChange={() => set('disclosure', v)}
                      />{' '}
                      {l}
                    </label>
                  ))}
                </fieldset>
                <Field label="Who hears what, when, from whom">
                  {(id) => (
                    <Textarea
                      id={id}
                      value={form.communication}
                      maxLength={2000}
                      onChange={(e) => set('communication', e.target.value)}
                    />
                  )}
                </Field>
              </div>
            </Card>
            <Card title="5 · Member and provider protection" subtitle={hint('protection')}>
              <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
                <Field label="Concrete steps">
                  {(id) => (
                    <Textarea
                      id={id}
                      value={form.protection}
                      maxLength={2000}
                      onChange={(e) => set('protection', e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Resources committed">
                  {(id) => (
                    <Input
                      id={id}
                      value={form.resources}
                      maxLength={1000}
                      onChange={(e) => set('resources', e.target.value)}
                      placeholder="People, budget, time"
                    />
                  )}
                </Field>
              </div>
            </Card>
            <Card title="6 · Corrective action" subtitle={hint('corrective')}>
              <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
                <Field label="Control, validation or process change">
                  {(id) => (
                    <Textarea
                      id={id}
                      value={form.corrective_action}
                      maxLength={2000}
                      onChange={(e) => set('corrective_action', e.target.value)}
                    />
                  )}
                </Field>
                <Field label="How you will monitor it">
                  {(id) => (
                    <Input
                      id={id}
                      value={form.monitoring}
                      maxLength={1000}
                      onChange={(e) => set('monitoring', e.target.value)}
                    />
                  )}
                </Field>
              </div>
            </Card>
          </div>
          {form.disclosure === 'none' && (
            <Callout tone="critical" title="Concealment scores zero">
              Choosing not to disclose sets every row of the response rubric to zero.
            </Callout>
          )}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              icon={<Send />}
              loading={respond.isPending}
              disabled={!form.owner.trim()}
            >
              Submit response
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
