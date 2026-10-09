import { Quote } from 'lucide-react'
import { useCatalog } from '../api/hooks'
import type { TeamView } from '../api/types'

/** Current stage: the executive question, the facilitator's transition line and the expected output. */
export function StageBanner({ team, compact }: { team: TeamView; compact?: boolean }) {
  const { data: catalog } = useCatalog()
  const stage = catalog?.stages.find((s) => s.id === team.clock.stage_id)
  if (!stage || team.clock.status === 'not_started') return null
  return (
    <section
      className={`stage-banner ${compact ? 'stage-banner--compact' : ''}`}
      aria-label="Current stage"
    >
      <div className="stage-banner__meta">
        <span className="stage-banner__chip">
          {stage.start} · {stage.title}
        </span>
        <span className="xs muted">{stage.duration_minutes} min</span>
      </div>
      <h2 className="stage-banner__question">{stage.executive_question}</h2>
      {!compact &&
        stage.transition_script &&
        stage.transition_script !== stage.executive_question && (
          <p className="stage-banner__quote">
            <Quote size={14} aria-hidden /> {stage.transition_script}
          </p>
        )}
      <div className="row wrap small secondary" style={{ '--gap': '16px' } as React.CSSProperties}>
        <span>
          <span className="muted">What happens · </span>
          {stage.what_happens}
        </span>
        <span>
          <span className="muted">Output · </span>
          <strong>{stage.primary_output}</strong>
        </span>
      </div>
    </section>
  )
}
