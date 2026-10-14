import {
  AlarmClock,
  BellRing,
  CheckCircle2,
  ChevronDown,
  Eye,
  Send,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Flag,
  Gavel,
  Hourglass,
  ListChecks,
  NotebookPen,
  Pause,
  Play,
  Quote,
  Rocket,
  Volume2,
  Scissors,
  Siren,
  Target,
  Users,
  Wrench,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { errorMessage } from '../api/client'
import {
  useCatalog,
  useCrisisCandidates,
  useFacilitatorAction,
  usePitchReview,
  useSessionPart,
} from '../api/hooks'
import type {
  ClockView,
  CrisisCandidate,
  SessionView,
  Severity,
  TeamProgress,
  TeamView,
} from '../api/types'
import { Countdown } from '../components/Countdown'
import { speak, stageAnnouncement, voiceSupported } from './voiceAnnouncer'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Field'
import { Badge, Callout } from '../components/ui/primitives'
import { useConfirm, useToast } from '../components/ui/toastContext'
import { clockText, money } from '../lib/format'
import { useRemaining } from '../lib/useRemaining'
import { RubricDialog } from './RubricDialog'
import { RunOfShow, TeamProgressCard } from './RunOverview'
import { teamAlerts } from './teamStatus'

type Run = (
  path: string,
  body?: Record<string, unknown>,
  method?: 'POST' | 'PUT',
  ok?: string,
) => Promise<boolean>

export function RunPanel({ session, token }: { session: SessionView; token: string }) {
  const action = useFacilitatorAction<Record<string, unknown>>(session.id, token)
  const toast = useToast()
  const confirm = useConfirm()
  const run: Run = async (path, body, method = 'POST', ok) => {
    try {
      await action.mutateAsync({ path, body, method })
      if (ok) toast(ok)
      return true
    } catch (e) {
      toast(errorMessage(e), 'error')
      return false
    }
  }
  const c = session.clock
  const stage = session.stages[c.stage_index]
  const last = session.stages.length - 1
  // A simulated year cannot be un-run, so Back stops at the Simulate stage that produced it.
  const lastSimIndex =
    session.simulated_years > 0
      ? session.stages.findIndex((s) => s.kind === `simulate_y${session.simulated_years}`)
      : -1
  const canGoBack = c.stage_index > 0 && c.stage_index - 1 >= lastSimIndex
  const goNext = async () => {
    // Entering a Simulate stage closes the round and runs the year: confirm if a team is still drafting.
    const upcoming = session.stages[c.stage_index + 1]
    const year = upcoming?.kind === 'simulate_y1' ? 1 : upcoming?.kind === 'simulate_y2' ? 2 : 0
    const runs = year > 0 && !(year === 2 && !session.round2_granted)
    // Run of show: pitches are scored and capital granted in Round 2, then Simulate Year 2 runs the
    // year. Without the grant the year cannot run, so moving on would skip it.
    if (
      year === 2 &&
      !session.round2_granted &&
      !(await confirm({
        title: 'Grant Round 2 capital first?',
        message:
          'Year 2 runs when you enter Simulate Year 2, and it cannot run until Round 2 capital is ' +
          'granted. Score every board pitch and grant capital in this stage before moving on.',
        tone: 'warning',
        confirmLabel: 'Move on without Year 2',
        cancelLabel: 'Stay and grant',
      }))
    )
      return
    const drafting = runs
      ? session.teams.filter((t) => (year === 1 ? !t.round1_submitted : !t.round2_submitted))
      : []
    if (
      drafting.length > 0 &&
      !(await confirm({
        title: `Run Year ${year} with unsubmitted teams?`,
        message:
          `${drafting.map((t) => t.team_name).join(', ')} not submitted yet. Moving on applies ` +
          `their current draft and runs Year ${year}; a simulated year cannot be undone.`,
        tone: 'warning',
        confirmLabel: `Run Year ${year}`,
      }))
    )
      return
    run(
      '/stage',
      { action: 'next' },
      'POST',
      runs ? `Year ${year} simulated: review the results, then release` : undefined,
    )
  }

  return (
    <div className="hq">
      <RunOfShow session={session} />

      <div className="hq__main">
        <section className="card hq-level" aria-labelledby="hq-level-title">
          <div className="hq-level__top">
            <div className="hq-level__info">
              <div className="hq-level__eyebrow">
                <span className="hq-level__badge">
                  Stage {c.stage_index + 1}
                  <span>/{session.stages.length}</span>
                </span>
                <span className="num">
                  {stage.start} · {stage.duration_minutes} min
                </span>
                {stage.lecture_minutes > 0 && (
                  <span className="hq-chip">Lecture ≤ {stage.lecture_minutes} min</span>
                )}
              </div>
              <h2 className="hq-level__title" id="hq-level-title">
                {stage.title.replace(' (optional extension)', '')}
              </h2>
              {stage.executive_question && (
                <p className="hq-level__question">{stage.executive_question}</p>
              )}
            </div>
            <TimerRing clock={c} minutes={stage.duration_minutes} />
          </div>
          <div className="hq-level__body">
            <div className="hq-level__controls">
              {c.status === 'not_started' && (
                <Button
                  variant="primary"
                  size="lg"
                  icon={<Play />}
                  onClick={() => run('/stage', { action: 'start' }, 'POST', 'Session started')}
                >
                  Start session
                </Button>
              )}
              {c.status === 'running' && (
                <Button icon={<Pause />} onClick={() => run('/stage', { action: 'pause' })}>
                  Pause
                </Button>
              )}
              {c.status === 'paused' && (
                <Button
                  variant="primary"
                  icon={<Play />}
                  onClick={() => run('/stage', { action: 'resume' })}
                >
                  Resume
                </Button>
              )}
              {c.status !== 'not_started' && (
                <>
                  <Button
                    icon={<ChevronLeft />}
                    disabled={!canGoBack}
                    title={
                      canGoBack
                        ? 'Return to the previous stage; its countdown resumes where it stopped'
                        : 'A simulated year cannot be undone'
                    }
                    onClick={() => run('/stage', { action: 'previous' })}
                  >
                    Back
                  </Button>
                  {c.stage_index < last ? (
                    <Button variant="primary" icon={<ChevronRight />} onClick={goNext}>
                      Next stage
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      icon={<Flag />}
                      disabled={c.status === 'completed'}
                      onClick={() =>
                        run('/stage', { action: 'complete' }, 'POST', 'Session complete')
                      }
                    >
                      Complete
                    </Button>
                  )}
                </>
              )}
            </div>
            {stage.transition_script && (
              <div className="hq-say">
                <Quote size={16} aria-hidden />
                <div className="grow">
                  <div className="hq-label">Say to the room</div>
                  <p>{stage.transition_script}</p>
                </div>
                {voiceSupported && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Volume2 />}
                    iconOnly
                    aria-label="Read the stage announcement aloud"
                    title="Read aloud to the room"
                    onClick={() => speak(stageAnnouncement(session, session.clock.stage_index))}
                  />
                )}
              </div>
            )}
            {stage.facilitator_script && (
              <div className="hq-cue">
                <Target aria-hidden />
                <div>
                  <div className="hq-label">Your cue</div>
                  <p>{stage.facilitator_script}</p>
                </div>
              </div>
            )}
            {/* Reference detail: open by default, can be folded away. */}
            <details className="hq-brief" open>
              <summary>
                <ListChecks aria-hidden /> Stage brief
                <span className="muted">
                  What happens, output
                  {stage.console_actions.length > 0 && ' and console checklist'}
                </span>
                <ChevronDown aria-hidden className="hq-brief__chev" />
              </summary>
              <dl className="hq-brief__meta">
                <div>
                  <dt className="hq-label">What happens</dt>
                  <dd>{stage.what_happens}</dd>
                </div>
                <div>
                  <dt className="hq-label">Output</dt>
                  <dd>{stage.primary_output}</dd>
                </div>
              </dl>
              {stage.console_actions.length > 0 && (
                <ul className="list-reset hq-brief__checks">
                  {stage.console_actions.map((a) => (
                    <li key={a}>
                      <CheckCircle2 aria-hidden /> {a}
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </div>
        </section>
        <StageActions session={session} token={token} run={run} busy={action.isPending} />
      </div>

      <section className="hq-squad" aria-labelledby="hq-squad-title">
        <header className="hq-squad__head">
          <h2 id="hq-squad-title">
            <Users aria-hidden /> Teams
            <span className="hq-count">{session.teams.length}</span>
          </h2>
        </header>
        <div className="grid grid-3">
          {session.teams.map((t) => (
            <TeamProgressCard key={t.team_id} t={t} session={session} />
          ))}
        </div>
      </section>
      <Observations session={session} run={run} />
    </div>
  )
}

/** The stage countdown inside a ring that empties as the stage runs; amber near the end, red over. */
function TimerRing({ clock, minutes }: { clock: ClockView; minutes: number }) {
  const remaining = useRemaining(clock)
  const total = clock.duration_seconds || minutes * 60
  const idle = clock.status === 'not_started'
  const done = clock.status === 'completed'
  const left = remaining ?? total
  const frac = idle ? 1 : done ? 0 : Math.max(0, Math.min(1, left / total))
  const tone = done
    ? 'done'
    : clock.status === 'paused'
      ? 'paused'
      : left < 0
        ? 'over'
        : left < 120 && !idle
          ? 'low'
          : 'ok'
  const R = 52
  const C = 2 * Math.PI * R
  return (
    <div className={`hq-ring hq-ring--${tone}`}>
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle className="hq-ring__track" cx="60" cy="60" r={R} />
        <circle
          className="hq-ring__fill"
          cx="60"
          cy="60"
          r={R}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
        />
      </svg>
      <div className="hq-ring__text">
        {idle ? (
          <span className="clock clock--big">{clockText(total)}</span>
        ) : done ? (
          <span className="clock clock--big">
            <Flag aria-hidden />
          </span>
        ) : (
          <Countdown clock={clock} big />
        )}
        <span className="hq-ring__label">
          {idle
            ? 'Ready'
            : done
              ? 'Complete'
              : tone === 'paused'
                ? 'Paused'
                : left < 0
                  ? 'Over time'
                  : 'Left'}
        </span>
      </div>
    </div>
  )
}

function PitchScorer({
  session,
  token,
  team,
  run,
}: {
  session: SessionView
  token: string
  team: TeamProgress
  run: Run
}) {
  const [open, setOpen] = useState(false)
  const { data: catalog } = useCatalog()
  const { data: review, isFetching } = usePitchReview(session.id, token, team.team_id, open)
  const tiers = session.rules.pitch_capital
  const earned = (total: number) => tiers.find((t) => total >= t.min_score)?.earned_musd ?? 0
  return (
    <>
      <div className="row">
        <span className="grow small">
          {team.team_name}
          {!team.pitch_submitted && <span className="muted"> · not submitted</span>}
        </span>
        {team.pitch_total != null && <Badge tone="accent">{team.pitch_total}/15</Badge>}
        <Button
          size="sm"
          icon={<Gavel />}
          onClick={() => setOpen(true)}
          disabled={session.round2_granted}
        >
          {team.pitch_total != null ? 'Rescore' : 'Score'}
        </Button>
      </div>
      {catalog && (
        <RubricDialog
          open={open}
          onClose={() => setOpen(false)}
          title={`Board pitch — ${team.team_name}`}
          rows={catalog.rubrics.pitch}
          score={review?.score}
          footerNote={(total) => (
            <>
              earns <strong>+{money(earned(total))}</strong> on the {money(team.round2_base_musd)}{' '}
              base
            </>
          )}
          onSave={async (rows, note) => {
            if (
              await run(`/teams/${team.team_id}/pitch-score`, { rows, note }, 'PUT', 'Pitch scored')
            )
              setOpen(false)
          }}
        >
          {isFetching && !review ? (
            <span className="small muted">Preparing the suggested score…</span>
          ) : (
            review && (
              <div className="pitch-review">
                {(['results', 'causal', 'decision', 'risk', 'ask'] as const).map((k) => (
                  <p key={k} className="small">
                    <span className="upper muted">{k}</span>{' '}
                    {String(review.pitch[k] ?? '') || <span className="muted">—</span>}
                  </p>
                ))}
                <p className="xs muted">
                  Evidence:{' '}
                  {(review.pitch.evidence as string[] | undefined)?.join(', ') || 'none cited'}
                </p>
                {review.unsupported_figures.length > 0 && (
                  <Callout tone="warning" title="Figures not found in the data room or results">
                    {review.unsupported_figures.join(', ')} — E6 (hallucinated financial assumption)
                    becomes available for this team.
                  </Callout>
                )}
              </div>
            )
          )}
        </RubricDialog>
      )}
    </>
  )
}

function RubricOverride({
  session,
  token,
  team,
  kind,
  run,
}: {
  session: SessionView
  token: string
  team: TeamProgress
  kind: 'opmodel' | 'crisis'
  run: Run
}) {
  const [open, setOpen] = useState(false)
  const { data: catalog } = useCatalog()
  const { data: detail } = useSessionPart<{ team: TeamView }>(
    session.id,
    token,
    `teams/${team.team_id}`,
    open,
  )
  const total = kind === 'opmodel' ? team.opmodel_total : team.crisis_total
  if (total == null || !catalog) return null
  const rubric = kind === 'opmodel' ? catalog.rubrics.opmodel : catalog.rubrics.crisis
  const ws = detail?.team.workspace
  const score = kind === 'opmodel' ? ws?.opmodel_score : ws?.crisis_score
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {total}/{rubric.length * 3} · review
      </Button>
      <RubricDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`${kind === 'opmodel' ? 'Operating model' : 'Crisis response'} — ${team.team_name}`}
        rows={rubric}
        score={score}
        onSave={async (values, note) => {
          if (
            await run(
              `/teams/${team.team_id}/${kind}-score`,
              { rows: values, note },
              'PUT',
              'Score updated',
            )
          )
            setOpen(false)
        }}
      >
        {kind === 'crisis' && ws?.crisis_response && (
          <div className="pitch-review">
            <p className="small">
              <span className="upper muted">Decision</span>{' '}
              {ws.crisis_response.decision.replace(/_/g, ' ')} ·{' '}
              <span className="upper muted">Disclosure</span>{' '}
              {ws.crisis_response.disclosure.replace(/_/g, ' ')}
            </p>
            <p className="small">
              <span className="upper muted">Owner</span> {ws.crisis_response.owner} /{' '}
              {ws.crisis_response.operational_lead || '—'}
            </p>
            <p className="small">
              <span className="upper muted">Communication</span>{' '}
              {ws.crisis_response.communication || '—'}
            </p>
            <p className="small">
              <span className="upper muted">Corrective</span>{' '}
              {ws.crisis_response.corrective_action || '—'}
            </p>
          </div>
        )}
        {kind === 'opmodel' && ws?.opmodel_findings && ws.opmodel_findings.length > 0 && (
          <Callout tone="warning" title="Engine findings">
            <ul className="bullets">
              {ws.opmodel_findings.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Callout>
        )}
      </RubricDialog>
    </>
  )
}

function StageActions({
  session,
  token,
  run,
  busy,
}: {
  session: SessionView
  token: string
  run: Run
  busy: boolean
}) {
  const nextYear = session.simulated_years + 1
  const pending = session.teams.filter(
    (t) => !(nextYear === 1 ? t.round1_submitted : t.round2_submitted),
  )
  const { data: candidates } = useCrisisCandidates(session.id, token, session.simulated_years >= 2)
  const compressed = !!session.options.opmodel_compressed
  const released = (session.options.released_years as number[] | undefined) ?? []
  const unreleased = [1, 2].filter((y) => y <= session.simulated_years && !released.includes(y))
  const simIndex = session.stages.findIndex((s) => s.kind === `simulate_y${nextYear}`)
  // Each block shows only around the stage that uses it, not for the rest of the session.
  const at = session.clock.stage_index
  const indexOf = (kind: string) => session.stages.findIndex((s) => s.kind === kind)
  // Board pitch scoring and the Round 2 grant belong to the Round 2 + board pitch stage (1:32).
  const r2Index = indexOf('invest_r2')
  const showBoard = at === r2Index && !session.round2_granted
  // Recovery only: the session left Round 2 without the grant, so Year 2 never ran and later
  // stages (crisis, scorecards) cannot work. Offer the grant once more, flagged as catch-up.
  const yearTwoSkipped = at > r2Index && session.simulated_years === 1 && !session.round2_granted
  // Content Pack §9.1: the compress cut is checked at 1:58, the start of the operating model stage.
  const showOpModel = at === indexOf('operating_model')
  // Crises are released in the Crisis stage; afterwards an unanswered one shows as a team alert.
  const crisisStage = at === indexOf('crisis') && session.simulated_years >= 2
  // Releasing again resets a team's response and score, so the bulk release is offered only once.
  const noCrisisYet = session.teams.every((t) => !t.crisis_event_id)
  const showScorecards = at >= indexOf('results')
  const started = session.clock.status !== 'not_started'
  const behind = Math.round(session.schedule_offset_minutes)
  // Content Pack §9.1: contingency cuts apply when 10 minutes or more behind. Smaller slips only
  // show as the chip on the run of show.
  const lateCut = started && behind >= 10
  // Hybrid capital depends on every pitch score: the server refuses the grant until each team is
  // scored, so say who is still waiting instead of failing on click.
  const unscored =
    session.round2_mechanic === 'hybrid'
      ? session.teams.filter((t) => t.pitch_total == null).map((t) => t.team_name)
      : []
  const blockedOnCapital = nextYear === 2 && !session.round2_granted
  // Only reached when Simulate Year 2 was entered before capital was granted.
  const runYearNow = nextYear <= 2 && !blockedOnCapital && simIndex <= at
  // The upcoming simulation is worth a line only during the round that feeds it.
  const roundIndex = indexOf(nextYear === 1 ? 'invest_r1' : 'invest_r2')
  const showUpcoming = nextYear <= 2 && !blockedOnCapital && simIndex > at && at >= roundIndex
  const watch = session.teams
    .map((t) => ({ t, alerts: teamAlerts(t, session) }))
    .filter((x) => x.alerts.length > 0)

  const now: ReactNode[] = []
  if (!started)
    now.push(
      <Quest
        key="start"
        icon={<Play />}
        title="Start when the room is ready"
        text="Read out each team's join code from the team cards below, then press Start session."
      />,
    )
  for (const y of unreleased)
    now.push(
      <Quest
        key={`y${y}`}
        urgent
        icon={<Eye />}
        title={`Year ${y} results are ready`}
        text={
          <>
            Check each team on the <strong>Results</strong> tab (pack §9.2), then release the
            performance review.
          </>
        }
      >
        <Button
          variant="primary"
          icon={<Send />}
          loading={busy}
          onClick={() =>
            run(`/results/${y}/release`, undefined, 'POST', `Year ${y} review released`)
          }
        >
          Release Year {y} performance review
        </Button>
      </Quest>,
    )
  if (showScorecards && session.simulated_years === 2 && !session.options.scorecards_released)
    now.push(
      <Quest
        key="scorecards"
        urgent
        icon={<Trophy />}
        title="Release the final scorecards"
        text="Then show the dimension profiles side by side."
      >
        <Button
          variant="primary"
          icon={<Trophy />}
          loading={busy}
          onClick={() => run('/scorecards/release', undefined, 'POST', 'Scorecards released')}
        >
          Release scorecards
        </Button>
      </Quest>,
    )
  if (runYearNow)
    now.push(
      <Quest
        key="simulate"
        urgent
        icon={<Rocket />}
        title={`Run Year ${nextYear}`}
        text="This stage was entered before the year ran. Run it now."
      >
        <Button
          variant="primary"
          icon={<Rocket />}
          loading={busy}
          onClick={() =>
            run('/simulate', { year: nextYear, force: true }, 'POST', `Year ${nextYear} simulated`)
          }
        >
          Run Year {nextYear} simulation
        </Button>
      </Quest>,
    )
  if ((showBoard || yearTwoSkipped) && session.simulated_years >= 1)
    now.push(
      <Quest
        key="board"
        urgent={yearTwoSkipped || unscored.length === 0}
        icon={<Gavel />}
        title={
          yearTwoSkipped
            ? 'Year 2 has not run: grant Round 2 capital'
            : 'Board pitch and Round 2 capital'
        }
        chip={session.round2_mechanic}
        text={
          yearTwoSkipped
            ? `The session left Round 2 without the grant, so Simulate Year 2 was skipped. ` +
              (unscored.length > 0
                ? `Score the remaining pitches (${unscored.join(', ')}), grant capital, then run Year 2.`
                : 'Grant capital, then run Year 2.')
            : unscored.length > 0
              ? `Score every board pitch, then grant capital · waiting on ${unscored.join(', ')}`
              : 'Every pitch is scored: grant Round 2 capital.'
        }
      >
        {session.round2_mechanic === 'hybrid' && (
          <div className="hq-rows">
            {session.teams.map((t) => (
              <PitchScorer key={t.team_id} session={session} token={token} team={t} run={run} />
            ))}
          </div>
        )}
        <Button
          variant="primary"
          loading={busy}
          disabled={unscored.length > 0}
          onClick={() => run('/round2/grant', undefined, 'POST', 'Round 2 capital granted')}
        >
          Grant Round 2 capital
        </Button>
      </Quest>,
    )
  if (crisisStage)
    now.push(
      <Quest
        key="crisis"
        urgent={noCrisisYet}
        icon={<AlarmClock />}
        title="Release the crisis"
        chip="engine pick first"
      >
        <CrisisRows session={session} token={token} candidates={candidates} run={run} />
        {noCrisisYet && (
          <Button
            variant="primary"
            icon={<Siren />}
            onClick={() => run('/crisis/assign', {}, 'POST', 'Recommended crises released')}
          >
            Release recommended crisis to all
          </Button>
        )}
      </Quest>,
    )

  const count = now.length + watch.length + (lateCut ? 1 : 0)

  return (
    <section className="card hq-needs" aria-labelledby="hq-needs-title">
      <header className="hq-needs__head">
        <h2 id="hq-needs-title">
          <BellRing aria-hidden /> Needs you
        </h2>
        <span className={`hq-count ${count > 0 ? 'hq-count--hot' : ''}`}>{count}</span>
      </header>
      <div className="hq-needs__body">
        {count === 0 && (
          <div className="hq-clear">
            <CheckCircle2 aria-hidden />
            <div>
              <div className="strong">All clear</div>
              <div className="small muted">
                Nothing needs you right now. Move on when the time box ends.
              </div>
            </div>
          </div>
        )}
        {now.length > 0 && (
          <div className="hq-group">
            <div className="hq-group__label">Do now</div>
            {now}
          </div>
        )}
        {(watch.length > 0 || lateCut) && (
          <div className="hq-group">
            <div className="hq-group__label">Watch</div>
            {lateCut && (
              <div className="hq-watch hq-watch--critical">
                <div className="hq-watch__title">
                  <Hourglass aria-hidden /> {behind} min behind the run of show
                </div>
                {session.contingency.length > 0 ? (
                  <ul className="list-reset hq-watch__list">
                    {session.contingency.map((h) => (
                      <li key={h.id}>
                        <strong>{h.condition}:</strong> {h.cut}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="small muted">No contingency cut applies at this point.</span>
                )}
              </div>
            )}
            {watch.map(({ t, alerts }) => (
              <div key={t.team_id} className="hq-watch">
                <div className="hq-watch__title">{t.team_name}</div>
                <ul className="list-reset hq-watch__list">
                  {alerts.map((a) => (
                    <li key={a.text} className={`hq-alert hq-alert--${a.tone}`}>
                      {a.tone === 'critical' ? <Siren aria-hidden /> : <BellRing aria-hidden />}
                      {a.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {(showUpcoming || (showOpModel && session.simulated_years >= 1)) && (
          <div className="hq-group hq-group--quiet">
            <div className="hq-group__label">For this stage</div>
            {showUpcoming && (
              <div className="hq-tool">
                <div className="hq-tool__title">
                  <Rocket aria-hidden /> Year {nextYear} runs when you move to Simulate Year{' '}
                  {nextYear}
                </div>
                <span className="xs muted">
                  Unsubmitted drafts are applied as submitted (invalid drafts are dropped).
                </span>
                <div className="hq-pills">
                  {session.teams.map((t) => (
                    <span
                      key={t.team_id}
                      className={`hq-chip ${pending.includes(t) ? 'hq-chip--warning' : 'hq-chip--good'}`}
                    >
                      {t.team_name} · {pending.includes(t) ? 'drafting' : 'submitted'}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {showOpModel && session.simulated_years >= 1 && (
              <OpModelTools session={session} token={token} run={run} compressed={compressed} />
            )}
          </div>
        )}
      </div>
    </section>
  )
}

/** One item in "Needs you": what to do, why, and the controls to do it. */
function Quest({
  icon,
  title,
  chip,
  text,
  urgent,
  children,
}: {
  icon: ReactNode
  title: ReactNode
  chip?: ReactNode
  text?: ReactNode
  urgent?: boolean
  children?: ReactNode
}) {
  return (
    <article className={`hq-quest ${urgent ? 'hq-quest--urgent' : ''}`}>
      <span className="hq-quest__icon" aria-hidden>
        {icon}
      </span>
      <div className="hq-quest__body">
        <div className="hq-quest__title">
          {title}
          {chip && <span className="hq-chip">{chip}</span>}
          {urgent && <span className="hq-chip hq-chip--critical">Priority</span>}
        </div>
        {text && <div className="hq-quest__text">{text}</div>}
        {children}
      </div>
    </article>
  )
}

/** Optional tools for the operating model exercise: the contingency cut and score reviews. */
function OpModelTools({
  session,
  token,
  run,
  compressed,
}: {
  session: SessionView
  token: string
  run: Run
  compressed: boolean
}) {
  return (
    <div className="hq-tool">
      <div className="hq-tool__title">
        <Wrench aria-hidden /> Operating model exercise
      </div>
      <label className="checkbox small">
        <input
          type="checkbox"
          checked={compressed}
          onChange={(e) =>
            run(
              '/options',
              {
                opmodel_compressed: e.target.checked,
                note: 'Contingency: behind schedule at 1:58',
              },
              'PUT',
              e.target.checked ? 'Compressed to steps 3–6' : 'Full exercise restored',
            )
          }
        />
        <Scissors size={13} aria-hidden /> Compress to steps 3 to 6 (contingency cut, see the
        Edition tab)
      </label>
      {session.teams
        .filter((t) => t.opmodel_total != null)
        .map((t) => (
          <div key={t.team_id} className="row">
            <span className="grow small">{t.team_name}</span>
            <RubricOverride session={session} token={token} team={t} kind="opmodel" run={run} />
          </div>
        ))}
    </div>
  )
}

/** Per-team crisis release: the engine's pick first, an override needs an audit note. */
function CrisisRows({
  session,
  token,
  candidates,
  run,
}: {
  session: SessionView
  token: string
  candidates: Record<string, CrisisCandidate[]> | undefined
  run: Run
}) {
  const [eventFor, setEventFor] = useState<Record<string, string>>({})
  const [sevFor, setSevFor] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  return (
    <div className="hq-rows">
      {session.teams.map((t) => {
        const list = candidates?.[t.team_id] ?? []
        const chosen = eventFor[t.team_id] ?? list[0]?.event_id ?? ''
        const rec = list.find((x) => x.event_id === chosen)
        const overriding = !!eventFor[t.team_id] && eventFor[t.team_id] !== list[0]?.event_id
        const sev = sevFor[t.team_id] ?? rec?.severity ?? 'medium'
        return (
          <div key={t.team_id} className="crisis-row">
            <div className="row">
              <span className="grow small strong">{t.team_name}</span>
              {t.crisis_event_id && (
                <Badge tone={t.crisis_responded ? 'good' : 'critical'}>
                  {t.crisis_event_id.toUpperCase()} {t.crisis_severity}
                </Badge>
              )}
              <RubricOverride session={session} token={token} team={t} kind="crisis" run={run} />
            </div>
            {t.crisis_event_id ? (
              <span className="xs muted">
                Released ·{' '}
                {t.crisis_responded ? 'response submitted' : 'awaiting the team’s response'}
              </span>
            ) : list.length === 0 ? (
              <span className="xs muted">
                No event fires for this portfolio (clean). You may still assign a curveball from the
                Teams tab.
              </span>
            ) : (
              <div className="row wrap" style={{ '--gap': '6px' } as React.CSSProperties}>
                <Select
                  aria-label={`Crisis for ${t.team_name}`}
                  style={{ flex: '1 1 220px' }}
                  value={chosen}
                  onChange={(e) => setEventFor({ ...eventFor, [t.team_id]: e.target.value })}
                >
                  {list.map((x, i) => (
                    <option key={x.event_id} value={x.event_id}>
                      {i === 0 ? '★ ' : ''}
                      {x.code} {x.title} — {x.severity}, p={x.probability}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label={`Severity for ${t.team_name}`}
                  style={{ width: 110 }}
                  value={sev}
                  onChange={(e) => setSevFor({ ...sevFor, [t.team_id]: e.target.value })}
                >
                  {['high', 'medium', 'low'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
                {(overriding || (rec && sev !== rec.severity)) && (
                  <Input
                    aria-label={`Override note for ${t.team_name}`}
                    placeholder="Audit note for the override"
                    style={{ flex: '1 1 200px' }}
                    value={notes[t.team_id] ?? ''}
                    onChange={(e) => setNotes({ ...notes, [t.team_id]: e.target.value })}
                  />
                )}
                <Button
                  size="sm"
                  onClick={() =>
                    run(
                      '/crisis/assign',
                      {
                        team_id: t.team_id,
                        event_id: chosen,
                        severity: sev as Severity,
                        note: notes[t.team_id] || 'Accepted engine recommendation',
                      },
                      'POST',
                      'Crisis released',
                    )
                  }
                >
                  Release
                </Button>
              </div>
            )}
            {rec?.governance_lowered && (
              <span className="xs muted">
                Severity lowered one level by owned AI governance (I10).
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Quick field note for the debrief: one line, out of the way until needed. */
function Observations({ session, run }: { session: SessionView; run: Run }) {
  const [text, setText] = useState('')
  const [team, setTeam] = useState('')
  return (
    <section className="card hq-notes" aria-label="Observation log">
      <form
        className="hq-notes__form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (
            await run('/observations', { text, team_id: team || null }, 'POST', 'Observation saved')
          )
            setText('')
        }}
      >
        <span className="hq-notes__label">
          <NotebookPen aria-hidden /> Field note
        </span>
        <Input
          aria-label="Observation for the debrief"
          placeholder="A quote, a turning point or a reasoning gap for the debrief…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
        />
        <Select aria-label="About" value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="">Whole room</option>
          {session.teams.map((t) => (
            <option key={t.team_id} value={t.team_id}>
              {t.team_name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="primary" disabled={!text.trim()}>
          Log
        </Button>
      </form>
    </section>
  )
}
