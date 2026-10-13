import { Bot, FileText, Send, Sparkles, User, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { errorMessage } from '../api/client'
import { useAskAnalyst } from '../api/hooks'
import type { AnalystAnswer, AnalystMode, TeamView } from '../api/types'
import { ArtifactViewer } from '../components/ArtifactViewer'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { Segmented, Textarea } from '../components/ui/Field'
import { Markdown } from '../components/ui/Markdown'
import { Badge, Callout } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'
import { AnalystContext, type AnalystPreset } from './analystContext'

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

/**
 * The AI analyst as a chat panel available on every team page: a floating button opens a side
 * panel; the conversation persists while the team moves between pages.
 */
export function AnalystProvider({ team, children }: { team: TeamView; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState<AnalystPreset>({})
  const openAnalyst = useCallback((p?: AnalystPreset) => {
    if (p) setPreset({ ...p })
    setOpen(true)
  }, [])
  const value = useMemo(() => ({ openAnalyst }), [openAnalyst])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <AnalystContext.Provider value={value}>
      {children}
      {!open && (
        <button
          type="button"
          className="analyst-fab"
          onClick={() => setOpen(true)}
          aria-label="Open AI analyst"
          title="Ask the AI analyst about your data room"
        >
          <Bot aria-hidden />
        </button>
      )}
      {/* Kept mounted while closed so an answer that is still on its way is not lost. */}
      <aside
        className={`analyst-drawer ${open ? 'is-open' : ''}`}
        aria-label="AI analyst"
        aria-hidden={!open}
        inert={!open}
      >
        <header className="analyst-drawer__head">
          <span className="analyst-drawer__icon" aria-hidden>
            <Bot />
          </span>
          <div className="grow">
            <div className="analyst-drawer__title">AI analyst</div>
            <div className="analyst-drawer__sub">
              {team.ai_enabled ? (
                <>
                  <Sparkles aria-hidden /> Claude connected · grounded in your data room
                </>
              ) : (
                'Retrieval-only mode · returns the most relevant data-room passages'
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<X />}
            iconOnly
            aria-label="Close AI analyst"
            title="Close (Esc)"
            onClick={() => setOpen(false)}
          />
        </header>
        <AnalystChat team={team} preset={preset} open={open} />
      </aside>
    </AnalystContext.Provider>
  )
}

function AnalystChat({
  team,
  preset,
  open,
}: {
  team: TeamView
  preset: AnalystPreset
  open: boolean
}) {
  const [mode, setMode] = useState<AnalystMode>(preset.mode ?? 'ask')
  const [context, setContext] = useState(preset.context ?? '')
  const [question, setQuestion] = useState('')
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
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // A page that opens the analyst with a mode or context (pitch coach, results explainer) sets it.
  useEffect(() => {
    if (preset.mode) setMode(preset.mode)
    setContext(preset.context ?? '')
  }, [preset])

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 200)
  }, [open, preset])

  useEffect(() => {
    try {
      sessionStorage.setItem(historyKey(team.team_id), JSON.stringify(turns.slice(-30)))
    } catch {
      /* ignore */
    }
    // Scroll only the chat thread; scrollIntoView would also move the page behind the panel.
    const el = threadRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
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
    <>
      <div className="analyst-drawer__thread analyst__thread" aria-live="polite" ref={threadRef}>
        {turns.length === 0 && (
          <div className="analyst-drawer__empty">
            <p className="secondary small">
              Ask about anything in your data room. The analyst cites artifact IDs, separates
              evidence from inference and will not decide for you.
            </p>
            <span className="upper muted">Try one of these</span>
            <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
              {PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="analyst-drawer__prompt"
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
                        {[...new Map(t.answer.sources.map((s) => [s.artifact_id, s])).values()].map(
                          (s) => (
                            <button
                              key={s.artifact_id}
                              type="button"
                              className={`badge ${t.answer!.citations.includes(s.artifact_id) ? 'badge--accent' : ''}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setDoc(s.artifact_id)}
                            >
                              <FileText aria-hidden /> {s.title}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form className="analyst__composer analyst-drawer__composer" onSubmit={submit}>
        <Segmented
          label="Analyst mode"
          value={mode}
          onChange={setMode}
          options={MODES.map((m) => ({ value: m.value, label: m.label }))}
        />
        {context && (
          <Callout tone="accent">
            <span className="row spread" style={{ width: '100%' }}>
              Using context from the page you came from.
              <button type="button" className="inv__more" onClick={() => setContext('')}>
                Clear
              </button>
            </span>
          </Callout>
        )}
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Textarea
            ref={inputRef}
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
            aria-label="Send"
            iconOnly
          />
        </div>
        <span className="xs muted">
          ⌘/Ctrl + Enter to send · Questions are logged for your facilitator's debrief.
        </span>
      </form>
      <Dialog open={!!doc} onClose={() => setDoc(null)} title="Source document" wide>
        {doc && <ArtifactViewer id={doc} />}
      </Dialog>
    </>
  )
}
