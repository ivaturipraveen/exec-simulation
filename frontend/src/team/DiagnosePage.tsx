import { FileText, Lock, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { errorMessage } from '../api/client'
import { useDataRoom, useSavePriorities } from '../api/hooks'
import type { Priority, TeamView } from '../api/types'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Dialog } from '../components/ui/Dialog'
import { Field, Input, Textarea } from '../components/ui/Field'
import { Badge, Callout, Empty, PageHeader } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'
import { DEPARTMENT_LABELS } from '../lib/format'

const blank = (): Priority => ({ title: '', rationale: '', evidence: [] })

export function DiagnosePage({ team }: { team: TeamView }) {
  const editable = team.flags.can_edit_priorities
  const [items, setItems] = useState<Priority[]>(
    team.workspace.priorities.length ? team.workspace.priorities : [blank()],
  )
  const [picking, setPicking] = useState<number | null>(null)
  const save = useSavePriorities()
  const toast = useToast()
  const { data: room } = useDataRoom()
  const titles = new Map((room ?? []).map((a) => [a.id, a.title]))

  useEffect(() => {
    if (!editable) setItems(team.workspace.priorities)
  }, [editable, team.workspace.priorities])

  const update = (i: number, patch: Partial<Priority>) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  async function onSave() {
    const clean = items.filter((p) => p.title.trim())
    try {
      await save.mutateAsync(clean)
      toast('Priorities saved')
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <PageHeader
        eyebrow="Diagnose"
        title="What is actually preventing 4+ Stars?"
        description="Separate symptoms from root causes. Name your top three priorities and the evidence behind each."
        actions={
          editable ? (
            <Button variant="primary" icon={<Save />} onClick={onSave} loading={save.isPending}>
              Save priorities
            </Button>
          ) : (
            <Badge icon={<Lock aria-hidden />}>Locked</Badge>
          )
        }
      />
      {!editable && (
        <Callout tone="neutral">
          Priorities are locked once Year 1 is simulated. They feed your debrief and learning
          evidence.
        </Callout>
      )}
      {items.length === 0 && <Empty title="No priorities recorded" />}
      <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
        {items.map((p, i) => (
          <Card
            key={i}
            title={`Priority ${i + 1}`}
            actions={
              editable &&
              items.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 />}
                  iconOnly
                  aria-label={`Remove priority ${i + 1}`}
                  onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
                />
              )
            }
          >
            <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
              <Field label="What is the underlying problem?">
                {(id) => (
                  <Input
                    id={id}
                    value={p.title}
                    disabled={!editable}
                    maxLength={160}
                    placeholder="e.g. Outreach targets members whose gaps are already closed"
                    onChange={(e) => update(i, { title: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Why do you believe it?" hint="Distinguish evidence from assumption.">
                {(id) => (
                  <Textarea
                    id={id}
                    value={p.rationale ?? ''}
                    disabled={!editable}
                    maxLength={2000}
                    onChange={(e) => update(i, { rationale: e.target.value })}
                  />
                )}
              </Field>
              <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
                <span className="field__label">Evidence</span>
                <div className="chip-list">
                  {(p.evidence ?? []).map((a) => (
                    <Badge key={a} tone="accent" icon={<FileText aria-hidden />}>
                      {titles.get(a) ?? a}
                    </Badge>
                  ))}
                  {editable && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Plus />}
                      onClick={() => setPicking(i)}
                    >
                      Cite evidence
                    </Button>
                  )}
                  {!editable && (p.evidence ?? []).length === 0 && (
                    <span className="muted small">None cited</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {editable && items.length < 3 && (
        <Button
          variant="secondary"
          icon={<Plus />}
          onClick={() => setItems((xs) => [...xs, blank()])}
        >
          Add priority
        </Button>
      )}
      <Dialog
        open={picking !== null}
        onClose={() => setPicking(null)}
        title="Cite evidence"
        subtitle="Select the documents that support this priority (up to 8)."
        footer={
          <Button variant="primary" onClick={() => setPicking(null)}>
            Done
          </Button>
        }
      >
        {picking !== null && (
          <ul className="list-reset stack" style={{ '--gap': '4px' } as React.CSSProperties}>
            {(room ?? []).map((a) => {
              const checked = (items[picking].evidence ?? []).includes(a.id)
              return (
                <li key={a.id}>
                  <label className="checkbox" style={{ padding: '6px 4px', width: '100%' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const ev = items[picking].evidence ?? []
                        update(picking, {
                          evidence: checked
                            ? ev.filter((x) => x !== a.id)
                            : [...ev, a.id].slice(0, 8),
                        })
                      }}
                    />
                    <span className="grow">
                      <span className="strong">{a.title}</span>
                      <span className="muted xs" style={{ display: 'block' }}>
                        {a.id} · {DEPARTMENT_LABELS[a.domain]}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </Dialog>
    </div>
  )
}
