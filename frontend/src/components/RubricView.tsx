import type { RubricRowView, RubricScore } from '../api/types'

/** 0–3 rubric rows with level descriptions; shows the suggestion when the final differs. */
export function RubricView({ rows, score }: { rows: RubricRowView[]; score: RubricScore }) {
  return (
    <div className="rubric">
      <div className="rubric__total">
        <span className="rubric__score num">
          {score.total}
          <span className="muted">/{score.max}</span>
        </span>
        <span className="xs muted">
          {score.overridden
            ? 'Facilitator score'
            : score.source === 'ai'
              ? 'AI-suggested score'
              : 'Suggested score'}
          {score.note && ` · ${score.note}`}
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
                {value} · {r.levels[value]}
                {score.overridden && suggested !== value && (
                  <span className="muted"> (suggested {suggested})</span>
                )}
              </div>
              {score.rationale[r.id] && <div className="xs muted">{score.rationale[r.id]}</div>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
