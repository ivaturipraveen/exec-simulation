import { Bot, FileText } from 'lucide-react'
import { useEffect } from 'react'
import type { AnalystAnswer } from '../api/types'
import { Markdown } from '../components/ui/Markdown'
import { Callout } from '../components/ui/primitives'
import { prefersReducedMotion, useTypewriter } from './useTypewriter'

export interface AnswerTurn {
  /** The answer as far as it has been written, while it is still arriving. */
  partial?: string
  answer?: AnalystAnswer
  error?: string
  /** Asked in this visit, so it types out. An answer loaded from history shows at once. */
  fresh?: boolean
}

/**
 * The analyst's side of the conversation: a chat bubble that types the answer out as it arrives,
 * then adds the sources it used once the answer is complete.
 */
export function AnswerBubble({
  turn,
  onOpenSource,
  onGrow,
}: {
  turn: AnswerTurn
  onOpenSource: (artifactId: string) => void
  /** Called whenever the bubble gets taller, so the thread can stay scrolled to the end. */
  onGrow?: () => void
}) {
  const full = turn.answer?.answer ?? turn.partial ?? ''
  const { text, typing } = useTypewriter(full, !!turn.fresh && !prefersReducedMotion())
  const waiting = !full && !turn.error // asked, nothing written yet
  const complete = !!turn.answer && !typing

  useEffect(() => {
    onGrow?.()
  }, [text, complete, onGrow])

  const sources = turn.answer
    ? [...new Map(turn.answer.sources.map((s) => [s.artifact_id, s])).values()]
    : []

  return (
    <div className="analyst__a">
      <span className="analyst__avatar analyst__avatar--ai">
        <Bot aria-hidden />
      </span>
      <div className={`analyst__bubble analyst__bubble--ai ${typing ? 'is-typing' : ''}`}>
        {waiting && (
          <span className="analyst__waiting">
            <span className="analyst__dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            Analyzing your data room…
          </span>
        )}
        {text && <Markdown>{text}</Markdown>}
        {turn.error && <Callout tone="critical">{turn.error}</Callout>}
        {complete && sources.length > 0 && (
          <div className="chip-list">
            {sources.map((s) => (
              <button
                key={s.artifact_id}
                type="button"
                className={`badge ${turn.answer!.citations.includes(s.artifact_id) ? 'badge--accent' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onOpenSource(s.artifact_id)}
              >
                <FileText aria-hidden /> {s.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
