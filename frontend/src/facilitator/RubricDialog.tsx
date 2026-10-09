import { useEffect, useState, type ReactNode } from 'react'
import type { RubricRowView, RubricScore } from '../api/types'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { Field, Textarea } from '../components/ui/Field'
import { Badge } from '../components/ui/primitives'

/** Facilitator scoring: start from the suggestion, adjust any row 0–3, explain with an audit note. */
export function RubricDialog({
  open,
  onClose,
  title,
  rows,
  score,
  onSave,
  saving,
  children,
  footerNote,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  rows: RubricRowView[]
  score: RubricScore | null | undefined
  onSave: (rows: Record<string, number>, note: string) => Promise<void> | void
  saving?: boolean
  children?: ReactNode
  footerNote?: (total: number) => ReactNode
}) {
  const [values, setValues] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')
  useEffect(() => {
    if (open && score) setValues({ ...score.rows })
  }, [open, score])
  const total = rows.reduce((n, r) => n + (values[r.id] ?? 0), 0)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      subtitle={
        score
          ? `Suggested ${score.source === 'ai' ? 'by AI' : 'by the engine'}: ${score.total}/${score.max}. You decide.`
          : undefined
      }
      wide
      footer={
        <>
          <span className="grow small">
            Total <strong className="num">{total}</strong> / {rows.length * 3}
            {footerNote && <> · {footerNote(total)}</>}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!note.trim()}
            onClick={() => onSave(values, note)}
          >
            Save score
          </Button>
        </>
      }
    >
      <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
        {children}
        <table className="table table--compact rubric-edit">
          <thead>
            <tr>
              <th>Criterion</th>
              <th style={{ width: 230 }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = values[r.id] ?? 0
              return (
                <tr key={r.id}>
                  <td>
                    <div className="strong small">{r.criterion}</div>
                    <div className="xs secondary">{r.good_answer}</div>
                    {score?.rationale[r.id] && (
                      <div className="xs muted">Suggestion: {score.rationale[r.id]}</div>
                    )}
                  </td>
                  <td>
                    <div className="segmented" role="group" aria-label={r.criterion}>
                      {[0, 1, 2, 3].map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={v === n}
                          onClick={() => setValues({ ...values, [r.id]: n })}
                          title={r.levels[n]}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="xs muted" style={{ marginTop: 4 }}>
                      {r.levels[v]}
                      {score && score.suggested[r.id] !== v && (
                        <Badge tone="warning">changed</Badge>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <Field label="Audit note (required)" hint="Recorded in the session log.">
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
      </div>
    </Dialog>
  )
}
