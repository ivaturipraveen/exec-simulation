import { ArrowRight, CheckCircle2, Circle, Crosshair, Quote } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../api/hooks'
import type { TeamView } from '../api/types'

/** Current stage: the executive question, the facilitator's transition line and the expected output,
 * beside "Your move": what this team has to do in this stage, whether it is done, and what comes next. */
export function StageBanner({ team, compact }: { team: TeamView; compact?: boolean }) {
  const { data: catalog } = useCatalog()
  const stage = catalog?.stages.find((s) => s.id === team.clock.stage_id)
  if (!stage || team.clock.status === 'not_started') return null
  const stages = (catalog?.stages ?? []).filter((s) => team.include_translation || !s.optional)
  const index = stages.findIndex((s) => s.id === stage.id)
  const next = stages[index + 1]
  const move = yourMove(team, stage.kind)
  return (
    <section
      className={`stage-banner stage-banner--hud ${compact ? 'stage-banner--compact' : ''}`}
      aria-label="Current stage"
    >
      <div className="stage-banner__main">
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
        <div
          className="row wrap small secondary"
          style={{ '--gap': '16px' } as React.CSSProperties}
        >
          <span>
            <span className="muted">What happens · </span>
            {stage.what_happens}
          </span>
          <span>
            <span className="muted">Output · </span>
            <strong>{stage.primary_output}</strong>
          </span>
        </div>
      </div>

      <aside className="stage-move" aria-label="Your move this stage">
        <div className="stage-move__head">
          <span className="stage-move__label">
            <Crosshair aria-hidden /> Your move
          </span>
          <span className={`stage-move__status ${move.done ? 'is-done' : ''}`}>
            {move.done ? <CheckCircle2 aria-hidden /> : <Circle aria-hidden />}
            {move.status}
          </span>
        </div>
        <p className="stage-move__task">{move.task}</p>
        <div className="stage-move__foot">
          <Link to={`/team/${move.page}`} className="btn btn--secondary btn--sm">
            {move.cta} <ArrowRight aria-hidden />
          </Link>
          <span className="stage-move__next">
            {next ? (
              <>
                <span className="muted">Next · {next.start}</span> {next.title}
              </>
            ) : (
              <span className="muted">Final stage</span>
            )}
          </span>
        </div>
      </aside>
    </section>
  )
}

interface Move {
  task: string
  status: string
  done: boolean
  page: string
  cta: string
}

/** The team's own job in this stage and its live status, from the team's workspace. */
function yourMove(team: TeamView, kind: string): Move {
  const ws = team.workspace
  const f = team.flags
  const cited = new Set(ws.priorities.flatMap((p) => p.evidence ?? [])).size
  switch (kind) {
    case 'briefing':
      return {
        task: 'Learn how Stars, capital and AI capability classes work before the clock starts.',
        status: 'Read the primer',
        done: false,
        page: 'primer',
        cta: 'Open primer',
      }
    case 'company':
      return {
        task: 'Read your briefing and board mandate; each role names one worry.',
        status: 'Read the briefing',
        done: false,
        page: '',
        cta: 'Open briefing',
      }
    case 'diagnose':
      return {
        task: 'Name your top three priorities, each backed by data-room evidence.',
        status: `${Math.min(3, ws.priorities.length)}/3 priorities · ${cited} cited`,
        done: ws.priorities.length >= 3 && cited > 0,
        page: 'diagnose',
        cta: 'Open diagnose',
      }
    case 'invest_r1':
      return {
        task: 'Place your Round 1 bets and write the thesis behind them.',
        status: ws.round1_submitted_at ? 'Round 1 submitted' : 'Not submitted yet',
        done: !!ws.round1_submitted_at,
        page: 'invest',
        cta: 'Open invest',
      }
    case 'simulate_y1':
    case 'simulate_y2': {
      const year = kind === 'simulate_y1' ? 1 : 2
      const ready = f.results_years.includes(year)
      return {
        task: ready
          ? `Your Year ${year} performance review is out. Read what moved and why.`
          : `The engine is running Year ${year}. Your review appears once the facilitator releases it.`,
        status: ready ? 'Review released' : 'Being reviewed',
        done: ready,
        page: 'results',
        cta: 'Open results',
      }
    }
    case 'analyze':
      return {
        task: 'Explain why results differed from your thesis, and draft the board pitch.',
        status: ws.pitch_submitted_at ? 'Pitch submitted' : 'Pitch in draft',
        done: !!ws.pitch_submitted_at,
        page: 'pitch',
        cta: 'Open board pitch',
      }
    case 'invest_r2':
      return {
        task: 'Pitch the board, then scale, pause or cancel and fund Round 2.',
        status: ws.round2_submitted_at
          ? 'Round 2 submitted'
          : ws.pitch_submitted_at
            ? 'Pitch in · Round 2 open'
            : 'Pitch and Round 2 open',
        done: !!ws.round2_submitted_at,
        page: ws.pitch_submitted_at ? 'invest' : 'pitch',
        cta: ws.pitch_submitted_at ? 'Open invest' : 'Open board pitch',
      }
    case 'operating_model':
      return {
        task: 'Decide where humans decide, AI assists and agents act across the workflow.',
        status: ws.opmodel_submitted_at ? 'Design submitted' : 'Not submitted yet',
        done: !!ws.opmodel_submitted_at,
        page: 'operating-model',
        cta: 'Open operating model',
      }
    case 'crisis':
      return {
        task: 'Contain the crisis, own it and say what you will tell the board.',
        status: !ws.crisis_event_id
          ? 'Waiting for the packet'
          : ws.crisis_response
            ? 'Response submitted'
            : 'Response due',
        done: !!ws.crisis_response,
        page: 'crisis',
        cta: 'Open crisis',
      }
    case 'results':
    case 'debrief':
      return {
        task: 'See the five-dimension scorecard and the story behind your result.',
        status: f.scorecard_available ? 'Scorecard released' : 'Being reviewed',
        done: f.scorecard_available,
        page: 'scorecard',
        cta: 'Open scorecard',
      }
    case 'translate': {
      const n = ws.opportunities.length
      return {
        task: 'Capture 2 to 3 real AI opportunities each for your own organization.',
        status: `${n} captured`,
        done: n > 0,
        page: 'opportunities',
        cta: 'Open opportunity map',
      }
    }
    default:
      return {
        task: 'Follow your facilitator.',
        status: '',
        done: false,
        page: '',
        cta: 'Open briefing',
      }
  }
}
