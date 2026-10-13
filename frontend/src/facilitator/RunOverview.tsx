import { BellRing, Check, Copy, Siren } from 'lucide-react'
import type { SessionView, TeamProgress } from '../api/types'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'
import { clockText, money, payerSuffix } from '../lib/format'
import { useRemaining } from '../lib/useRemaining'

/** Minutes → "h:mm" (e.g. 205 → "3:25"). */
function hm(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

/** Run of show: every stage with its planned slot, what is done, what is live and how far through the
 * session we are. Read-only: only the Back and Next stage buttons move the session. */
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
  const stagePct =
    started && c.duration_seconds && remaining != null
      ? Math.min(100, Math.max(0, ((c.duration_seconds - remaining) / c.duration_seconds) * 100))
      : 0
  const next = stages[c.stage_index + 1]

  return (
    <Card
      title="Run of show"
      subtitle={
        started
          ? `Stage ${c.stage_index + 1} of ${stages.length} · hover a circle for its time slot`
          : 'Not started yet: press Start below when the room is ready'
      }
      actions={
        <div className="ros__summary">
          <div>
            <span className="ros__label">Session time</span>
            <span className="ros__value num">
              {hm(elapsed)} <span className="muted">/ {hm(total)}</span>
            </span>
          </div>
          {started && remaining != null && (
            <div>
              <span className="ros__label">This stage</span>
              <span className={`ros__value num ${remaining < 0 ? 'ros__value--over' : ''}`}>
                {remaining < 0 ? `+${clockText(-remaining)} over` : `${clockText(remaining)} left`}
              </span>
            </div>
          )}
          {next && (
            <div>
              <span className="ros__label">Up next</span>
              <span className="ros__value">
                {next.start} {next.title.replace(' (optional extension)', '')}
              </span>
            </div>
          )}
        </div>
      }
    >
      <ol className="tp__dots ros-dots" aria-label="Stages">
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
          const title = s.title.replace(' (optional extension)', '')
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
      <div className={`tp__current ${started ? 'is-now' : 'is-idle'}`}>
        {started && current ? (
          <>
            <span className="tp__current-label">Now</span>
            <span className="tp__current-text">
              {c.stage_index + 1}. {current.title.replace(' (optional extension)', '')} ·{' '}
              {current.duration_minutes} min
            </span>
            <span className="ros-dots__bar" aria-hidden>
              <span style={{ width: `${stagePct}%` }} />
            </span>
          </>
        ) : (
          <span className="tp__current-text">
            Not started yet · hover a circle to see each stage
          </span>
        )}
      </div>
    </Card>
  )
}

type Step = {
  label: string
  kinds: string[]
  done: boolean
  value: string
}

/** One team at a glance: join code, its progress through the workshop in stage order, key numbers and alerts. */
export function TeamProgressCard({ t, session }: { t: TeamProgress; session: SessionView }) {
  const toast = useToast()
  const c = session.clock
  const stageKind = c.status === 'not_started' ? '' : c.stage_kind
  const indexOf = (kinds: string[]) => {
    const idx = session.stages.findIndex((s) => kinds.includes(s.kind))
    return idx < 0 ? Number.POSITIVE_INFINITY : idx
  }
  const steps: Step[] = [
    {
      label: 'Diagnose priorities',
      kinds: ['diagnose'],
      done: t.priorities > 0,
      value: t.priorities > 0 ? `${t.priorities} set · ${t.evidence_cited} cited` : '',
    },
    {
      label: 'Investment Round 1',
      kinds: ['invest_r1'],
      done: t.round1_submitted,
      value: t.round1_submitted ? 'Submitted' : '',
    },
    {
      label: 'Board pitch',
      kinds: ['analyze', 'invest_r2'],
      done: t.pitch_submitted,
      value: t.pitch_total != null ? `${t.pitch_total}/15` : t.pitch_submitted ? 'To score' : '',
    },
    {
      label: 'Investment Round 2',
      kinds: ['invest_r2'],
      done: t.round2_submitted,
      value: t.round2_submitted ? 'Submitted' : '',
    },
    {
      label: 'Operating model',
      kinds: ['operating_model'],
      done: t.opmodel_submitted,
      value:
        t.opmodel_total != null ? `${t.opmodel_total}/12` : t.opmodel_submitted ? 'Submitted' : '',
    },
    {
      label: 'Crisis response',
      kinds: ['crisis'],
      done: t.crisis_responded,
      value:
        t.crisis_total != null
          ? `${t.crisis_total}/18`
          : t.crisis_event_id
            ? `${t.crisis_event_id.toUpperCase()} ${t.crisis_severity ?? ''} live`
            : '',
    },
    {
      label: 'Opportunity map',
      kinds: ['translate'],
      done: t.opportunities > 0,
      value: t.opportunities > 0 ? `${t.opportunities} captured` : '',
    },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const started = c.status !== 'not_started'
  const crisisStageIndex = indexOf(['crisis'])
  const states = steps.map((s, index) => {
    const now = started && s.kinds.includes(stageKind) && !s.done
    const missed =
      started && !s.done && !now && c.stage_index > Math.max(...s.kinds.map((k) => indexOf([k])))
    const state = s.done ? 'done' : now ? 'now' : missed ? 'missed' : 'todo'
    const noCrisis =
      s.kinds.includes('crisis') &&
      !t.crisis_event_id &&
      started &&
      c.stage_index >= crisisStageIndex
    const status =
      s.value ||
      (noCrisis
        ? 'No crisis fired (clean portfolio). Assign one from the Teams tab if you want one.'
        : state === 'now'
          ? 'Working on it now'
          : state === 'missed'
            ? 'Not submitted'
            : 'Coming up')
    return { ...s, index, state, status }
  })
  // The step to call out under the circles: the live one, else the first missed one.
  const current =
    states.find((s) => s.state === 'now') ?? states.find((s) => s.state === 'missed') ?? null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(t.join_code)
      toast(`Join code ${t.join_code} copied`)
    } catch {
      toast('Copy is blocked in this browser; read the code out instead', 'error')
    }
  }

  return (
    <section className="card tp" aria-label={t.team_name}>
      <header className="tp__head">
        <div className="grow">
          <div className="tp__name">{t.team_name}</div>
          {payerSuffix(t.team_name, t.payer_name) && (
            <div className="tp__payer">{t.payer_name}</div>
          )}
        </div>
        <button type="button" className="tp__code" onClick={copy} title="Copy join code">
          <span className="tp__code-label">Join code</span>
          <span className="tp__code-value">{t.join_code}</span>
          <Copy aria-hidden />
        </button>
      </header>

      <div className="tp__progress">
        <div className="tp__progress-text">
          <span className="strong">Progress</span>
          <span className="muted num">
            {doneCount} of {steps.length} done
          </span>
        </div>
        <ol className="tp__dots" aria-label="Workshop steps">
          {states.map((s, i) => (
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
        <div className={`tp__current is-${current ? current.state : 'idle'}`}>
          {current ? (
            <>
              <span className="tp__current-label">
                {current.state === 'now' ? 'Now' : 'Needs attention'}
              </span>
              <span className="tp__current-text">
                {current.index + 1}. {current.label} · {current.status}
              </span>
            </>
          ) : (
            <span className="tp__current-text">
              {!started
                ? 'Waiting for the session to start'
                : doneCount === steps.length
                  ? 'All steps complete'
                  : 'Nothing due in this stage · hover a circle for details'}
            </span>
          )}
        </div>
      </div>

      <div className="tp__stats">
        <div>
          <span className="tp__stat-label">Capital left</span>
          <span className="tp__stat-value num">{money(t.available_musd)}</span>
          <span className="tp__stat-sub">of {money(t.granted_musd)}</span>
        </div>
        <div>
          <span className="tp__stat-label">Root causes</span>
          <span className="tp__stat-value num">
            {t.root_causes_cited}/{t.root_causes_total}
          </span>
          <span className="tp__stat-sub">evidenced</span>
        </div>
        <div>
          <span className="tp__stat-label">AI queries</span>
          <span className="tp__stat-value num">{t.ai_requests}</span>
          <span className="tp__stat-sub">asked</span>
        </div>
        {t.stars_projected != null && (
          <div>
            <span className="tp__stat-label">Stars</span>
            <span className="tp__stat-value num">★ {t.stars_projected.toFixed(1)}</span>
            <span className="tp__stat-sub">projected</span>
          </div>
        )}
        {t.score_total != null && (
          <div>
            <span className="tp__stat-label">Score</span>
            <span className="tp__stat-value num">{t.score_total.toFixed(0)}</span>
            <span className="tp__stat-sub">of 100</span>
          </div>
        )}
      </div>

      {(t.needs_nudge ||
        (t.capacity_peak != null && t.capacity_peak > 1) ||
        t.pitch_figures.length > 0 ||
        t.crisis_event_id) && (
        <div className="tp__alerts">
          {t.needs_nudge && (
            <Badge tone="warning" icon={<BellRing aria-hidden />}>
              Nudge: no evidence cited yet
            </Badge>
          )}
          {t.capacity_peak != null && t.capacity_peak > 1 && (
            <Badge
              tone={t.capacity_peak > session.rules.capacity_overrun_cap ? 'critical' : 'warning'}
            >
              Capacity peak {Math.round(t.capacity_peak * 100)}%
            </Badge>
          )}
          {t.pitch_figures.length > 0 && (
            <Badge tone="warning">Unsourced figure: {t.pitch_figures.join(', ')}</Badge>
          )}
          {t.crisis_event_id &&
            (t.crisis_responded ? (
              <Badge tone="good" icon={<Siren aria-hidden />}>
                Crisis {t.crisis_event_id.toUpperCase()} handled
              </Badge>
            ) : (
              <Badge tone="critical" icon={<Siren aria-hidden />}>
                Crisis {t.crisis_event_id.toUpperCase()} live · {t.crisis_severity}
              </Badge>
            ))}
        </div>
      )}
    </section>
  )
}
