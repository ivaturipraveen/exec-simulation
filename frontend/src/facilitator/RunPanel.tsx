import {
  AlarmClock,
  Eye,
  Send,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Flag,
  Gavel,
  ListChecks,
  NotebookPen,
  Pause,
  Play,
  Quote,
  Volume2,
  Scissors,
  Siren,
} from 'lucide-react'
import { useState } from 'react'
import { errorMessage } from '../api/client'
import {
  useCatalog,
  useCrisisCandidates,
  useFacilitatorAction,
  usePitchReview,
  useSessionPart,
} from '../api/hooks'
import type { SessionView, Severity, TeamProgress, TeamView } from '../api/types'
import { Countdown } from '../components/Countdown'
import { speak, stageAnnouncement, voiceSupported } from './voiceAnnouncer'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { Badge, Callout } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'
import { money } from '../lib/format'
import { RubricDialog } from './RubricDialog'
import { RunOfShow, TeamProgressCard } from './RunOverview'

type Run = (
  path: string,
  body?: Record<string, unknown>,
  method?: 'POST' | 'PUT',
  ok?: string,
) => Promise<boolean>

export function RunPanel({ session, token }: { session: SessionView; token: string }) {
  const action = useFacilitatorAction<Record<string, unknown>>(session.id, token)
  const toast = useToast()
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
  const behind = session.schedule_offset_minutes
  // A simulated year cannot be un-run, so Back stops at the Simulate stage that produced it.
  const lastSimIndex =
    session.simulated_years > 0
      ? session.stages.findIndex((s) => s.kind === `simulate_y${session.simulated_years}`)
      : -1
  const canGoBack = c.stage_index > 0 && c.stage_index - 1 >= lastSimIndex
  const goNext = () => {
    // Entering a Simulate stage closes the round and runs the year: confirm if a team is still drafting.
    const upcoming = session.stages[c.stage_index + 1]
    const year = upcoming?.kind === 'simulate_y1' ? 1 : upcoming?.kind === 'simulate_y2' ? 2 : 0
    const runs = year > 0 && !(year === 2 && !session.round2_granted)
    const drafting = runs
      ? session.teams.filter((t) => (year === 1 ? !t.round1_submitted : !t.round2_submitted))
      : []
    if (
      drafting.length > 0 &&
      !window.confirm(
        `${drafting.map((t) => t.team_name).join(', ')} not submitted yet. Moving on applies ` +
          `their current draft and runs Year ${year}; a simulated year cannot be undone. Continue?`,
      )
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
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <RunOfShow session={session} />

      {c.status !== 'not_started' && behind >= 2 && (
        <Callout
          tone={behind >= 10 ? 'warning' : 'neutral'}
          title={
            behind > 0
              ? `${behind.toFixed(0)} minutes behind the run-of-show`
              : `${(-behind).toFixed(0)} minutes ahead`
          }
        >
          {session.contingency.length > 0 ? (
            <ul className="bullets">
              {session.contingency.map((h) => (
                <li key={h.id}>
                  <strong>{h.condition}:</strong> {h.cut}
                </li>
              ))}
            </ul>
          ) : (
            'No contingency cut applies at this point.'
          )}
        </Callout>
      )}

      <div className="grid grid-split">
        <Card
          title={
            <span className="row">
              <span className="upper muted">
                {stage.start} · Stage {c.stage_index + 1}
              </span>{' '}
              {stage.title}
            </span>
          }
          subtitle={stage.executive_question}
        >
          <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
            <div className="row spread wrap">
              <Countdown clock={c} big />
              <div className="row wrap">
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
            </div>
            {stage.transition_script && (
              <div className="script">
                <Quote size={15} aria-hidden />
                <div className="grow">
                  <div className="upper muted">Say</div>
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
            <div
              className="row wrap small secondary"
              style={{ '--gap': '16px' } as React.CSSProperties}
            >
              <span>
                What happens: <strong>{stage.what_happens}</strong>
              </span>
              <span>
                Output: <strong>{stage.primary_output}</strong>
              </span>
              {stage.lecture_minutes > 0 && <span>Lecture ≤ {stage.lecture_minutes} min</span>}
            </div>
            {stage.console_actions.length > 0 && (
              <div className="console-actions">
                <span className="upper muted row" style={{ '--gap': '6px' } as React.CSSProperties}>
                  <ListChecks size={13} aria-hidden /> Console actions
                </span>
                <ul className="list-reset">
                  {stage.console_actions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            <Callout tone="accent" title="Facilitator notes">
              {stage.facilitator_script}
            </Callout>
          </div>
        </Card>
        <StageActions session={session} token={token} run={run} busy={action.isPending} />
      </div>

      <div className="grid grid-3">
        {session.teams.map((t) => (
          <TeamProgressCard key={t.team_id} t={t} session={session} />
        ))}
      </div>
      <Observations session={session} run={run} />
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
  const [eventFor, setEventFor] = useState<Record<string, string>>({})
  const [sevFor, setSevFor] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const compressed = !!session.options.opmodel_compressed
  const released = (session.options.released_years as number[] | undefined) ?? []
  const unreleased = [1, 2].filter((y) => y <= session.simulated_years && !released.includes(y))
  const simIndex = session.stages.findIndex((s) => s.kind === `simulate_y${nextYear}`)
  // Each block shows only around the stage that uses it, not for the rest of the session.
  const at = session.clock.stage_index
  const indexOf = (kind: string) => session.stages.findIndex((s) => s.kind === kind)
  // Board pitch scoring and the Round 2 grant: from the board pitch stage until capital is granted
  // (still shown in Simulate Year 2 if it was entered before the grant, so the year can run).
  const showBoard = at >= indexOf('invest_r2') && !session.round2_granted
  // The compress cut is a contingency for the run into the operating model exercise; not after it.
  const showOpModel = at >= indexOf('simulate_y2') && at <= indexOf('operating_model')
  // Crises are released and answered in the Crisis stage. After it, the block stays only while a
  // released crisis still waits for its response (to score it), and offers no new releases.
  const crisisStage = at === indexOf('crisis')
  const crisisTeams = crisisStage
    ? session.teams
    : session.teams.filter((t) => t.crisis_event_id && !t.crisis_responded)
  const showCrisis = at >= indexOf('crisis') && crisisTeams.length > 0
  // Releasing again resets a team's response and score, so the bulk release is offered only once.
  const noCrisisYet = session.teams.every((t) => !t.crisis_event_id)
  const showScorecards = at >= indexOf('results')

  return (
    <Card title="Stage actions" subtitle="What needs to happen to move on">
      <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
        {session.clock.status === 'not_started' && (
          <Callout tone="accent">Share each team's join code, then start the session.</Callout>
        )}
        {unreleased.map((y) => (
          <div key={y} className="release-box">
            <div className="strong small row" style={{ '--gap': '6px' } as React.CSSProperties}>
              <Eye size={14} aria-hidden /> Year {y} results are ready — review before release
            </div>
            <span className="small secondary">
              Check each team on the <strong>Results</strong> tab (pack §9.2), then release the
              performance review.
            </span>
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
          </div>
        ))}
        {showScorecards &&
          session.simulated_years === 2 &&
          !session.options.scorecards_released && (
            <div className="release-box">
              <div className="strong small">Final scorecards</div>
              <span className="small secondary">
                Release at Final results, then show the dimension profiles side by side.
              </span>
              <Button
                variant="primary"
                icon={<Trophy />}
                loading={busy}
                onClick={() => run('/scorecards/release', undefined, 'POST', 'Scorecards released')}
              >
                Release scorecards
              </Button>
            </div>
          )}
        {nextYear <= 2 && (
          <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
            <div className="strong small">Year {nextYear} simulation</div>
            {nextYear === 2 && !session.round2_granted ? (
              <span className="small muted">
                Score the pitches and grant Round 2 capital first.
              </span>
            ) : simIndex > session.clock.stage_index ? (
              <span className="small secondary">
                Runs automatically when you move to <strong>Simulate Year {nextYear}</strong>; any
                unsubmitted draft is applied as submitted (invalid drafts are dropped).
                {pending.length > 0 && (
                  <> Still drafting: {pending.map((t) => t.team_name).join(', ')}.</>
                )}
              </span>
            ) : (
              // Only reached when Simulate Year 2 was entered before capital was granted.
              <Button
                variant="primary"
                loading={busy}
                onClick={() =>
                  run(
                    '/simulate',
                    { year: nextYear, force: true },
                    'POST',
                    `Year ${nextYear} simulated`,
                  )
                }
              >
                Run Year {nextYear} simulation
              </Button>
            )}
          </div>
        )}
        {showBoard && session.simulated_years >= 1 && (
          <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
            <div className="strong small">
              Board pitch and Round 2 capital · {session.round2_mechanic}
            </div>
            {session.round2_mechanic === 'hybrid' &&
              session.teams.map((t) => (
                <PitchScorer key={t.team_id} session={session} token={token} team={t} run={run} />
              ))}
            {(() => {
              // Hybrid capital depends on every pitch score: the server refuses the grant until
              // each team is scored, so say who is still waiting instead of failing on click.
              const unscored =
                session.round2_mechanic === 'hybrid'
                  ? session.teams.filter((t) => t.pitch_total == null).map((t) => t.team_name)
                  : []
              return (
                <>
                  {unscored.length > 0 && (
                    <span className="xs muted">
                      Score every board pitch first · waiting on {unscored.join(', ')}
                    </span>
                  )}
                  <Button
                    variant="primary"
                    loading={busy}
                    disabled={unscored.length > 0}
                    onClick={() =>
                      run('/round2/grant', undefined, 'POST', 'Round 2 capital granted')
                    }
                  >
                    Grant Round 2 capital
                  </Button>
                </>
              )
            })()}
          </div>
        )}
        {showOpModel && session.simulated_years >= 1 && (
          <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
            <div className="strong small">Operating model exercise</div>
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
                  <RubricOverride
                    session={session}
                    token={token}
                    team={t}
                    kind="opmodel"
                    run={run}
                  />
                </div>
              ))}
          </div>
        )}
        {showCrisis && session.simulated_years >= 2 && (
          <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
            <div className="strong small row" style={{ '--gap': '6px' } as React.CSSProperties}>
              <AlarmClock size={14} aria-hidden /> Crisis — engine recommendation first
            </div>
            {crisisTeams.map((t) => {
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
                    <RubricOverride
                      session={session}
                      token={token}
                      team={t}
                      kind="crisis"
                      run={run}
                    />
                  </div>
                  {t.crisis_event_id ? (
                    <span className="xs muted">
                      Released ·{' '}
                      {t.crisis_responded ? 'response submitted' : 'awaiting the team’s response'}
                    </span>
                  ) : list.length === 0 ? (
                    <span className="xs muted">
                      No event fires for this portfolio (clean). You may still assign a curveball
                      from the Teams tab.
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
            {crisisStage && noCrisisYet && (
              <Button
                variant="secondary"
                icon={<Siren />}
                onClick={() => run('/crisis/assign', {}, 'POST', 'Recommended crises released')}
              >
                Release recommended crisis to all
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function Observations({ session, run }: { session: SessionView; run: Run }) {
  const [text, setText] = useState('')
  const [team, setTeam] = useState('')
  return (
    <Card
      title={
        <span className="row">
          <NotebookPen size={16} aria-hidden /> Observation log
        </span>
      }
      subtitle="Capture reasoning and moments for the debrief"
    >
      <form
        className="row wrap"
        style={{ alignItems: 'flex-end' }}
        onSubmit={async (e) => {
          e.preventDefault()
          if (
            await run('/observations', { text, team_id: team || null }, 'POST', 'Observation saved')
          )
            setText('')
        }}
      >
        <div className="grow">
          <Field label="Observation">
            {(id) => (
              <Textarea
                id={id}
                rows={2}
                style={{ minHeight: 56 }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={2000}
              />
            )}
          </Field>
        </div>
        <Field label="Team">
          {(id) => (
            <Select
              id={id}
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              style={{ width: 200 }}
            >
              <option value="">Whole room</option>
              {session.teams.map((t) => (
                <option key={t.team_id} value={t.team_id}>
                  {t.team_name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit" variant="primary" disabled={!text.trim()}>
          Log
        </Button>
      </form>
    </Card>
  )
}
