import { Check, Copy, Star } from 'lucide-react'
import type { SessionView, TeamProgress } from '../api/types'
import { useToast } from '../components/ui/toastContext'
import { money, payerSuffix } from '../lib/format'
import { useRemaining } from '../lib/useRemaining'
import { teamSteps } from './teamStatus'

/** Minutes → "h:mm" (e.g. 205 → "3:25"). */
function hm(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

const shortTitle = (title: string) => title.replace(' (optional extension)', '')

/** Run of show as a level track: every stage with its planned slot, what is done and what is live,
 * plus the session clock and the schedule. Read-only: only Back and Next stage move the session. */
export function RunOfShow({ session }: { session: SessionView }) {
  const c = session.clock
  const remaining = useRemaining(c)
  const started = c.status !== 'not_started'
  const stages = session.stages
  const total = stages.reduce((n, s) => n + s.duration_minutes, 0)
  const before = stages.slice(0, c.stage_index).reduce((n, s) => n + s.duration_minutes, 0)
  const current = stages[c.stage_index]
  const inStage =
    started && remaining != null ? Math.max(0, c.duration_seconds - remaining) / 60 : 0
  const elapsed = started
    ? Math.min(total, before + Math.min(inStage, current?.duration_minutes ?? 0))
    : 0
  const next = stages[c.stage_index + 1]
  const behind = Math.round(session.schedule_offset_minutes)
  const schedule = !started
    ? null
    : behind >= 2
      ? { tone: behind >= 10 ? 'bad' : 'warn', text: `${behind} min behind` }
      : behind <= -2
        ? { tone: 'good', text: `${-behind} min ahead` }
        : { tone: 'good', text: 'On schedule' }

  return (
    <section className="card hq-track" aria-label="Run of show">
      <div className="hq-track__head">
        <span className="hq-label">Run of show</span>
        <div className="hq-track__stats">
          <span className="hq-stat">
            <span className="hq-label">Session</span>
            <span className="num">
              {hm(elapsed)} <span className="muted">/ {hm(total)}</span>
            </span>
          </span>
          {next && (
            <span className="hq-stat">
              <span className="hq-label">Up next</span>
              <span>
                <span className="num muted">{next.start}</span> {shortTitle(next.title)}
              </span>
            </span>
          )}
          {schedule && <span className={`hq-chip hq-chip--${schedule.tone}`}>{schedule.text}</span>}
        </div>
      </div>
      <ol className="tp__dots ros-dots hq-track__dots" aria-label="Stages">
        {stages.map((s, i) => {
          const state = !started
            ? 'todo'
            : i < c.stage_index
              ? 'done'
              : i === c.stage_index
                ? 'now'
                : 'todo'
          const startMin = s.start
            .split(':')
            .map(Number)
            .reduce((h, m) => h * 60 + m)
          const title = shortTitle(s.title)
          const status =
            state === 'done'
              ? 'Done'
              : state === 'now'
                ? 'In progress'
                : s.optional
                  ? 'Optional'
                  : 'Coming up'
          return (
            <li key={s.id} className={`tp__dot-item is-${state}`}>
              <button
                type="button"
                className={`tp__dot is-${state} ${s.optional ? 'is-optional' : ''}`}
                aria-label={`Stage ${i + 1}, ${title}: ${status}`}
                aria-describedby={`ros-tip-${i}`}
                aria-current={state === 'now' ? 'step' : undefined}
              >
                {state === 'done' ? <Check aria-hidden /> : i + 1}
              </button>
              <span className="tp__tip" role="tooltip" id={`ros-tip-${i}`}>
                <span className="tp__tip-title">
                  {i + 1}. {title}
                </span>
                <span>
                  {s.start}–{hm(startMin + s.duration_minutes)} · {s.duration_minutes} min
                </span>
                <span className={`tp__tip-status is-${state}`}>{status}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** One team at a glance: where it is and its key numbers. What needs the facilitator is listed once,
 * in "Needs you", not repeated here. Before the start the join code leads; then it shrinks. */
export function TeamProgressCard({ t, session }: { t: TeamProgress; session: SessionView }) {
  const toast = useToast()
  const started = session.clock.status !== 'not_started'
  const steps = teamSteps(t, session)
  const doneCount = steps.filter((s) => s.done).length
  const live = steps.find((s) => s.state === 'now')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(t.join_code)
      toast(`Join code ${t.join_code} copied`)
    } catch {
      toast('Copy is blocked in this browser; read the code out instead', 'error')
    }
  }
  const code = (
    <button
      type="button"
      className={`tp__code ${started ? 'tp__code--small' : ''}`}
      onClick={copy}
      title="Copy join code"
    >
      <span className="tp__code-label">Join code</span>
      <span className="tp__code-value">{t.join_code}</span>
      <Copy aria-hidden />
    </button>
  )

  return (
    <section className="card tp hq-team" aria-label={t.team_name}>
      <header className="hq-team__head">
        <div className="grow">
          <div className="tp__name">{t.team_name}</div>
          {payerSuffix(t.team_name, t.payer_name) && (
            <div className="tp__payer">{t.payer_name}</div>
          )}
        </div>
        {code}
      </header>

      <div className="hq-team__progress">
        <div className="hq-team__xp-row">
          <span className="hq-label">Progress</span>
          <span className="num strong small">
            {doneCount}
            <span className="muted">/{steps.length}</span>
          </span>
        </div>
        <ol className="tp__dots" aria-label="Workshop steps">
          {steps.map((s, i) => (
            <li key={s.label} className={`tp__dot-item is-${s.state}`}>
              <button
                type="button"
                className={`tp__dot is-${s.state}`}
                aria-label={`Step ${i + 1}, ${s.label}: ${s.status}`}
                aria-describedby={`tip-${t.team_id}-${i}`}
              >
                {s.state === 'done' ? <Check aria-hidden /> : i + 1}
              </button>
              <span className="tp__tip" role="tooltip" id={`tip-${t.team_id}-${i}`}>
                <span className="tp__tip-title">
                  {i + 1}. {s.label}
                </span>
                <span className={`tp__tip-status is-${s.state}`}>{s.status}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="hq-team__now small">
          {!started
            ? 'Waiting for the session to start'
            : live
              ? `${live.label} · ${live.status}`
              : doneCount === steps.length
                ? 'All steps complete'
                : 'Nothing due in this stage'}
        </div>
      </div>

      <div className="hq-team__stats">
        <div>
          <span className="hq-label">Capital left</span>
          <span className="hq-team__value num">{money(t.available_musd)}</span>
          <span className="xs muted">of {money(t.granted_musd)}</span>
        </div>
        <div>
          <span className="hq-label">Root causes</span>
          <span className="hq-team__value num">
            {t.root_causes_cited}
            <span className="muted">/{t.root_causes_total}</span>
          </span>
          <span className="xs muted">evidenced</span>
        </div>
        {t.stars_projected != null ? (
          <div>
            <span className="hq-label">Stars</span>
            <span className="hq-team__value num">
              <Star aria-hidden className="hq-star" /> {t.stars_projected.toFixed(1)}
            </span>
            <span className="xs muted">
              {t.score_total != null ? `score ${t.score_total.toFixed(0)}/100` : 'projected'}
            </span>
          </div>
        ) : (
          <div>
            <span className="hq-label">AI queries</span>
            <span className="hq-team__value num">{t.ai_requests}</span>
            <span className="xs muted">asked</span>
          </div>
        )}
      </div>
    </section>
  )
}
