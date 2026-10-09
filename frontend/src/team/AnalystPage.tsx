import { Bot, FileText, Send, Sparkles, User } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useAskAnalyst } from '../api/hooks'
import type { AnalystAnswer, AnalystMode, TeamView } from '../api/types'
import { ArtifactViewer } from '../components/ArtifactViewer'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Dialog } from '../components/ui/Dialog'
import { Segmented, Textarea } from '../components/ui/Field'
import { Markdown } from '../components/ui/Markdown'
import { Badge, Callout, PageHeader } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'

interface Turn {
  question: string
  mode: AnalystMode
  answer?: AnalystAnswer
  error?: string
}

const MODES: { value: AnalystMode; label: string; placeholder: string }[] = [
  {
    value: 'ask',
    label: 'Analyst',
    placeholder: 'e.g. Where do complaints concentrate, and what changed before they rose?',
  },
  {
    value: 'challenge',
    label: 'Challenger',
    placeholder: 'What would make our Round 1 thesis wrong?',
  },
  {
    value: 'explain',
    label: 'Explainer',
    placeholder: 'Why did our outreach investment underperform plan?',
  },
  {
    value: 'pitch',
    label: 'Pitch coach',
    placeholder: 'Critique our 90-second board pitch against the rubric.',
  },
  {
    value: 'opportunity',
    label: 'Translator',
    placeholder: 'How would predictive adherence apply in my organization?',
  },
]

const PROMPTS = [
  'Which signals in the data room conflict with each other?',
  'Where could a headline number be misleading us?',
  'What does the data room say about our implementation capacity?',
  'Which evidence would change our mind about our top priority?',
]

const historyKey = (teamId: string) => `execsim.analyst.${teamId}`

export function AnalystPage({ team }: { team: TeamView }) {
  const location = useLocation()
  const preset = (location.state ?? {}) as { mode?: AnalystMode; context?: string }
  const [mode, setMode] = useState<AnalystMode>(preset.mode ?? 'ask')
  const [question, setQuestion] = useState('')
  const [context] = useState(preset.context ?? '')
  const [turns, setTurns] = useState<Turn[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(historyKey(team.team_id)) ?? '[]') as Turn[]
    } catch {
      return []
    }
  })
  const [doc, setDoc] = useState<string | null>(null)
  const ask = useAskAnalyst()
  const toast = useToast()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(historyKey(team.team_id), JSON.stringify(turns.slice(-30)))
    } catch {
      /* ignore */
    }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, team.team_id])

  const thesisContext = () => {
    if (context) return context
    if (mode === 'challenge') return team.workspace.thesis_r2 || team.workspace.thesis_r1
    if (mode === 'pitch')
      return Object.entries(team.workspace.pitch)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
    return ''
  }

  async function submit(e?: FormEvent, text?: string) {
    e?.preventDefault()
    const q = (text ?? question).trim()
    if (q.length < 3) return
    const idx = turns.length
    setTurns((t) => [...t, { question: q, mode }])
    setQuestion('')
    try {
      const answer = await ask.mutateAsync({
        question: q,
        mode,
        context: thesisContext().slice(0, 6000),
      })
      setTurns((t) => t.map((x, i) => (i === idx ? { ...x, answer } : x)))
    } catch (err) {
      const message = errorMessage(err)
      setTurns((t) => t.map((x, i) => (i === idx ? { ...x, error: message } : x)))
      toast(message, 'error')
    }
  }

  const current = MODES.find((m) => m.value === mode)!

  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <PageHeader
        eyebrow="Analytical workforce"
        title="AI analyst"
        description="Four scripted roles plus free-form questions, grounded only in your data room. It cites artifact IDs, separates evidence from inference, refuses figures it cannot source, and will not decide for you."
        actions={
          team.ai_enabled ? (
            <Badge tone="good" icon={<Sparkles aria-hidden />}>
              Claude connected
            </Badge>
          ) : (
            <Badge tone="warning">Retrieval-only mode</Badge>
          )
        }
      />
      {!team.ai_enabled && (
        <Callout tone="warning" title="Generative AI is not configured on this server">
          The analyst will return the most relevant passages from your data room. Your facilitator
          can enable Claude by adding an API key.
        </Callout>
      )}
      <Card flush>
        <div className="analyst__thread" aria-live="polite">
          {turns.length === 0 && (
            <div className="stack" style={{ '--gap': '10px', padding: 24 } as React.CSSProperties}>
              <span className="secondary">Try one of these:</span>
              <div className="chip-list">
                {PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => submit(undefined, p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className="analyst__turn">
              <div className="analyst__q">
                <span className="analyst__avatar">
                  <User aria-hidden />
                </span>
                <div className="grow">
                  <Badge>{MODES.find((m) => m.value === t.mode)?.label}</Badge>
                  <p style={{ marginTop: 6 }}>{t.question}</p>
                </div>
              </div>
              <div className="analyst__a">
                <span className="analyst__avatar analyst__avatar--ai">
                  <Bot aria-hidden />
                </span>
                <div className="grow stack" style={{ '--gap': '10px' } as React.CSSProperties}>
                  {!t.answer && !t.error && (
                    <span className="row muted">
                      <span className="spinner" aria-hidden /> Analyzing your data room…
                    </span>
                  )}
                  {t.error && <Callout tone="critical">{t.error}</Callout>}
                  {t.answer && (
                    <>
                      <Markdown>{t.answer.answer}</Markdown>
                      {t.answer.sources.length > 0 && (
                        <div className="chip-list">
                          {[
                            ...new Map(t.answer.sources.map((s) => [s.artifact_id, s])).values(),
                          ].map((s) => (
                            <button
                              key={s.artifact_id}
                              type="button"
                              className={`badge ${t.answer!.citations.includes(s.artifact_id) ? 'badge--accent' : ''}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setDoc(s.artifact_id)}
                            >
                              <FileText aria-hidden /> {s.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form className="analyst__composer" onSubmit={submit}>
          <Segmented
            label="Analyst mode"
            value={mode}
            onChange={setMode}
            options={MODES.map((m) => ({ value: m.value, label: m.label }))}
          />
          {context && <Callout tone="accent">Using results context from your QBR.</Callout>}
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Textarea
              aria-label="Your question"
              value={question}
              placeholder={current.placeholder}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
              }}
              rows={2}
              maxLength={2000}
              style={{ minHeight: 60 }}
            />
            <Button
              type="submit"
              variant="primary"
              icon={<Send />}
              loading={ask.isPending}
              disabled={question.trim().length < 3}
            >
              Send
            </Button>
          </div>
          <span className="xs muted">
            ⌘/Ctrl + Enter to send · Questions are logged for your facilitator's debrief.
          </span>
        </form>
      </Card>
      <Dialog open={!!doc} onClose={() => setDoc(null)} title="Source document" wide>
        {doc && <ArtifactViewer id={doc} />}
      </Dialog>
    </div>
  )
}
