import { Bot, Lock, Save, Send, ShieldCheck, User, Workflow } from 'lucide-react'
import { useState } from 'react'
import { errorMessage } from '../api/client'
import { useCatalog, useSaveOpModel } from '../api/hooks'
import type { OperatingModelDesign, StepDesign, TeamView, WorkflowMode } from '../api/types'
import { RubricView } from '../components/RubricView'
import { StageBanner } from '../components/StageBanner'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Field, Input, Textarea } from '../components/ui/Field'
import { Badge, Callout, Empty, Loading, PageHeader } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'

const MODES: { value: WorkflowMode; label: string; short: string; icon: React.ElementType }[] = [
  { value: 'human', label: 'Human-owned', short: 'Human', icon: User },
  {
    value: 'ai_assist',
    label: 'AI-assisted (human acts, AI recommends)',
    short: 'AI-assisted',
    icon: Bot,
  },
  {
    value: 'agent_approval',
    label: 'Agent-executed with approval',
    short: 'Agent + approval',
    icon: Workflow,
  },
  {
    value: 'autonomous',
    label: 'Bounded autonomous execution',
    short: 'Bounded autonomous',
    icon: ShieldCheck,
  },
]
const RISK_TONE = { low: 'good', medium: 'warning', high: 'critical' } as const
const isAgent = (m: WorkflowMode) => m === 'agent_approval' || m === 'autonomous'

export function OperatingModelPage({ team }: { team: TeamView }) {
  const { data: catalog } = useCatalog()
  const ws = team.workspace
  const editable = team.flags.can_edit_opmodel
  const save = useSaveOpModel()
  const toast = useToast()
  const [design, setDesign] = useState<OperatingModelDesign | null>(ws.opmodel_design ?? null)
  if (!catalog) return <Loading />
  const compressed = team.flags.opmodel_compressed
  const steps = catalog.workflow_steps.filter(
    (s) => !compressed || (s.number >= 3 && s.number <= 6),
  )
  const current: OperatingModelDesign = design ?? {
    steps: catalog.workflow_steps.map((s) => ({
      step_id: s.id,
      mode: 'human',
      controls: [],
      owner: '',
      dimensions: {},
    })),
    accountable_executive: '',
    notes: '',
  }
  const stepFor = (id: string) => current.steps.find((s) => s.step_id === id)!
  const update = (id: string, patch: Partial<StepDesign>) =>
    setDesign({
      ...current,
      steps: current.steps.map((s) => (s.step_id === id ? { ...s, ...patch } : s)),
    })

  async function persist(submit: boolean) {
    try {
      await save.mutateAsync({ design: current, submit })
      toast(submit ? 'Operating model submitted' : 'Draft saved')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  if (!editable && !ws.opmodel_submitted_at) {
    return (
      <Empty title="Opens at the Agent operating model stage" icon={<Lock aria-hidden />}>
        After Year 2 results, you will redesign the nine-step quality-gap closure workflow.
      </Empty>
    )
  }
  const agentSteps = steps.filter((s) => isAgent(stepFor(s.id).mode))
  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <PageHeader
        eyebrow="Human versus AI operating model"
        title="Quality-gap closure: who decides, who assists, who acts?"
        description="Assign each step one of four options. For every step you give to an agent, answer the six decision dimensions. Autonomy itself never scores: value, control adequacy, adoption feasibility and recoverability do."
        actions={
          editable && (
            <>
              <Button icon={<Save />} onClick={() => persist(false)} loading={save.isPending}>
                Save draft
              </Button>
              <Button
                variant="primary"
                icon={<Send />}
                onClick={() => persist(true)}
                loading={save.isPending}
              >
                Submit design
              </Button>
            </>
          )
        }
      />
      <StageBanner team={team} compact />
      {compressed && (
        <Callout tone="accent" title="Compressed exercise">
          The facilitator has shortened this exercise to steps 3 to 6 (prioritize to notify
          provider).
        </Callout>
      )}
      {ws.opmodel_score && (
        <div className="grid grid-split">
          <Card title="Design score" subtitle="Four rows, 0 to 3 each">
            <RubricView rows={catalog.rubrics.opmodel} score={ws.opmodel_score} />
          </Card>
          {ws.opmodel_findings.length > 0 && (
            <Callout tone="warning" title="Design findings">
              <ul className="bullets">
                {ws.opmodel_findings.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Callout>
          )}
        </div>
      )}
      <div className="workflow">
        {steps.map((s) => {
          const d = stepFor(s.id)
          return (
            <section key={s.id} className={`workflow__step workflow__step--${d.mode}`}>
              <header className="workflow__head">
                <span className="workflow__n">{s.number}</span>
                <div className="grow">
                  <div className="strong">{s.name}</div>
                  <div className="xs muted">{s.description}</div>
                </div>
                <div className="row wrap" style={{ '--gap': '4px' } as React.CSSProperties}>
                  <Badge tone={RISK_TONE[s.risk_level as keyof typeof RISK_TONE]} outline>
                    {s.risk_level} consequence
                  </Badge>
                  {s.member_facing && <Badge outline>Member-facing</Badge>}
                  {s.sensitive && (
                    <Badge tone="warning" outline>
                      Sensitive
                    </Badge>
                  )}
                </div>
              </header>
              <div className="mode-picker" role="radiogroup" aria-label={`Mode for ${s.name}`}>
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={d.mode === m.value}
                    disabled={!editable}
                    className={`mode-picker__opt ${d.mode === m.value ? 'is-on' : ''}`}
                    onClick={() => update(s.id, { mode: m.value })}
                    title={m.label}
                  >
                    <m.icon aria-hidden /> {m.short}
                  </button>
                ))}
              </div>
              <div className="workflow__body">
                <div className="opmodel__controls" aria-label="Controls">
                  {catalog.workflow_controls.map((c) => (
                    <label key={c.id} className="checkbox xs" title={c.description}>
                      <input
                        type="checkbox"
                        disabled={!editable}
                        checked={(d.controls ?? []).includes(c.id)}
                        onChange={(e) =>
                          update(s.id, {
                            controls: e.target.checked
                              ? [...(d.controls ?? []), c.id]
                              : (d.controls ?? []).filter((x) => x !== c.id),
                          })
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
                <Input
                  aria-label={`Operational owner for ${s.name}`}
                  value={d.owner ?? ''}
                  disabled={!editable}
                  maxLength={120}
                  placeholder="Operational owner (role)"
                  onChange={(e) => update(s.id, { owner: e.target.value })}
                />
              </div>
              {isAgent(d.mode) && (
                <div className="dims">
                  <div className="upper muted">Six decision dimensions for this agent step</div>
                  <div className="dims__grid">
                    {catalog.decision_dimensions.map((dim) => (
                      <Field key={dim.id} label={dim.name} hint={dim.description}>
                        {(id) => (
                          <Textarea
                            id={id}
                            rows={2}
                            style={{ minHeight: 52 }}
                            value={(d.dimensions ?? {})[dim.id] ?? ''}
                            disabled={!editable}
                            maxLength={600}
                            onChange={(e) =>
                              update(s.id, {
                                dimensions: { ...(d.dimensions ?? {}), [dim.id]: e.target.value },
                              })
                            }
                          />
                        )}
                      </Field>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </div>
      <div className="grid grid-2">
        <Card
          title="Accountable executive"
          subtitle="Who remains responsible for outcomes across the workflow?"
        >
          <Input
            aria-label="Accountable executive"
            value={current.accountable_executive ?? ''}
            disabled={!editable}
            maxLength={120}
            placeholder="Name and title"
            onChange={(e) => setDesign({ ...current, accountable_executive: e.target.value })}
          />
        </Card>
        <Card
          title="Notes for the debrief"
          subtitle={`${agentSteps.length} step(s) given to an agent`}
        >
          <Textarea
            aria-label="Design notes"
            value={current.notes ?? ''}
            disabled={!editable}
            maxLength={2000}
            placeholder="Defend the lines you drew: where a person decides and why."
            onChange={(e) => setDesign({ ...current, notes: e.target.value })}
          />
        </Card>
      </div>
    </div>
  )
}
