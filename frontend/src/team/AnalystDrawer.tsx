import { Bot, Send, Sparkles, X } from 'lucide-react'
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
import { askAnalyst } from '../api/hooks'
import type { AnalystMode, TeamView } from '../api/types'
import { ArtifactViewer } from '../components/ArtifactViewer'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { Segmented, Textarea } from '../components/ui/Field'
import { Callout } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'
import { shouldBlockWheel } from '../lib/wheelGuard'
import { AnalystContext, type AnalystPreset } from './analystContext'
import { AnswerBubble, type AnswerTurn } from './AnswerBubble'

interface Turn extends AnswerTurn {
  question: string
  mode: AnalystMode
}

/** What is kept between visits: finished conversations only, never a half-written answer. */
const forHistory = ({ question, mode, answer, error }: Turn): Turn => ({
  question,
  mode,
  answer,
  error,
})

/** A saved turn with no answer was cut off (the page was closed mid-answer): say so, do not spin. */
const settled = (t: Turn): Turn =>
  t.answer || t.error ? t : { ...t, error: 'This answer was interrupted. Ask the question again.' }

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
  'Which data-room signals conflict?',
  'Where might a headline number mislead us?',
  'What does the data say about our capacity?',
  'What evidence would change our top priority?',
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

  // Scrolling inside the panel stays inside it. A wheel gesture over a part of the panel that cannot
  // scroll (the header, the question box) would otherwise carry on into the page behind. React's own
  // wheel handlers are passive and cannot stop that, so this is a native, non-passive listener.
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = panel.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && shouldBlockWheel(e.target, el, e.deltaY)) {
        e.preventDefault()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

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
        ref={panel}
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
            <div className="analyst-drawer__titlerow">
              <div className="analyst-drawer__title">AI analyst</div>
              {team.ai_enabled ? (
                <span className="analyst-drawer__status">
                  <span className="analyst-drawer__dot" aria-hidden /> Claude connected
                </span>
              ) : (
                <span className="analyst-drawer__status analyst-drawer__status--off">
                  <span className="analyst-drawer__dot" aria-hidden /> Retrieval only
                </span>
              )}
            </div>
            <div className="analyst-drawer__sub">
              {team.ai_enabled ? (
                <span>
                  <Sparkles aria-hidden /> Grounded in your data room
                </span>
              ) : (
                <span>Shows the most relevant data-room passages</span>
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
      const saved = JSON.parse(sessionStorage.getItem(historyKey(team.team_id)) ?? '[]') as Turn[]
      return saved.map(settled)
    } catch {
      return []
    }
  })
  const [doc, setDoc] = useState<string | null>(null)
  const [busy, setBusy] = useState(false) // an answer is being written
  const toast = useToast()
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const request = useRef<AbortController | null>(null)

  // Leaving the page cancels an answer that is still being written.
  useEffect(() => () => request.current?.abort(), [])

  // A page that opens the analyst with a mode or context (pitch coach, results explainer) sets it.
  useEffect(() => {
    if (preset.mode) setMode(preset.mode)
    setContext(preset.context ?? '')
  }, [preset])

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 200)
  }, [open, preset])

  useEffect(() => {
    if (busy) return // keep the conversation as it was until the answer is complete
    try {
      sessionStorage.setItem(
        historyKey(team.team_id),
        JSON.stringify(turns.slice(-30).map(forHistory)),
      )
    } catch {
      /* ignore */
    }
  }, [turns, busy, team.team_id])

  // A new question scrolls the thread to the end. Scroll only the thread; scrollIntoView would also
  // move the page behind the panel.
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [turns.length])

  // While an answer types out, stay at the end, but only if the reader has not scrolled up.
  const keepAtEnd = useCallback(() => {
    const el = threadRef.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 140) el.scrollTop = el.scrollHeight
  }, [])

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
    if (q.length < 3 || busy) return
    const idx = turns.length
    const update = (change: (x: Turn) => Partial<Turn>) =>
      setTurns((t) => t.map((x, i) => (i === idx ? { ...x, ...change(x) } : x)))
    setTurns((t) => [...t, { question: q, mode, fresh: true }])
    setQuestion('')
    setBusy(true)
    const controller = new AbortController()
    request.current = controller
    try {
      const answer = await askAnalyst(
        { question: q, mode, context: thesisContext().slice(0, 6000) },
        { onDelta: (piece) => update((x) => ({ partial: (x.partial ?? '') + piece })) },
        controller.signal,
      )
      update(() => ({ answer }))
    } catch (err) {
      if (controller.signal.aborted) return
      const message = errorMessage(err)
      update(() => ({ error: message }))
      toast(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const current = MODES.find((m) => m.value === mode)!

  return (
    <>
      <div
        className="analyst-drawer__thread analyst__thread"
        aria-live="polite"
        aria-busy={busy} // screen readers wait for the whole answer instead of reading every typed letter
        ref={threadRef}
      >
        {turns.length === 0 && (
          <div className="analyst-drawer__empty">
            <p className="secondary small">
              Ask about anything in your data room. The analyst cites artifact IDs, separates
              evidence from inference and will not decide for you.
            </p>
            <span className="upper muted">Try one of these</span>
            <div className="analyst-drawer__prompts">
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
              <span className="analyst__q-mode">
                {MODES.find((m) => m.value === t.mode)?.label}
              </span>
              <p className="analyst__bubble analyst__bubble--user">{t.question}</p>
            </div>
            <AnswerBubble turn={t} onOpenSource={setDoc} onGrow={keepAtEnd} />
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
            loading={busy}
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
