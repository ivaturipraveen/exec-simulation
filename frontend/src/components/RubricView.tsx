import { CheckCircle2 } from 'lucide-react'
import type { RubricRowView, RubricScore } from '../api/types'

const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? []
const FILLER = new Set(['a', 'an', 'the', 'of', 'for', 'to', 'and', 'with', 'is', 'are'])
/** True when the rationale only repeats the level text (same words, any order), so it adds nothing. */
const restates = (rationale: string, level: string) => {
  const have = new Set(words(level))
  return words(rationale).every((w) => FILLER.has(w) || have.has(w))
}

/** 0–3 rubric rows with level descriptions; shows the suggestion when the final differs. */
export function RubricView({ rows, score }: { rows: RubricRowView[]; score: RubricScore }) {
  return (
    <div className="rubric">
      {/* The result arrives as a solid brand-blue band that animates in once, so it is obvious where to
          look. The total appears here only; each row below shows just its own 0-3. */}
      <div className="rubric__result" role="status">
        <CheckCircle2 className="rubric__result-icon" size={28} aria-hidden />
        <div className="rubric__result-text">
          <span className="rubric__verdict-label">
            {score.overridden
              ? 'Score received · facilitator'
              : score.source === 'ai'
                ? 'Score received · AI-suggested'
                : 'Score received'}
          </span>
          {score.note && <span className="rubric__verdict-note">{score.note}</span>}
        </div>
        <span className="rubric__big num" aria-label={`${score.total} out of ${score.max}`}>
          {score.total}
          <span className="rubric__big-of">/{score.max}</span>
        </span>
      </div>
      <ul className="list-reset rubric__rows">
        {rows.map((r) => {
          const value = score.rows[r.id] ?? 0
          const suggested = score.suggested[r.id] ?? 0
          return (
            <li key={r.id} className="rubric__row">
              <div className="rubric__head">
                <span className="strong small">{r.criterion}</span>
                <span className="dots" aria-label={`${value} of 3`}>
                  {[1, 2, 3].map((i) => (
                    <span key={i} className={`dot ${i <= value ? 'dot--on' : ''}`} />
                  ))}
                </span>
              </div>
              <div className="xs secondary">
                {r.levels[value]}
                {score.overridden && suggested !== value && (
                  <span className="muted"> (suggested {suggested})</span>
                )}
              </div>
              {score.rationale[r.id] && !restates(score.rationale[r.id], r.levels[value]) && (
                <div className="xs muted">{score.rationale[r.id]}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
