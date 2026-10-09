import { Check, Maximize, Minimize, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useScoreboard, useSession } from '../api/hooks'
import { useRealtime } from '../api/realtime'
import type { SessionView } from '../api/types'
import { Countdown } from '../components/Countdown'
import { Loading } from '../components/ui/primitives'
import { auth } from '../lib/storage'

type Team = SessionView['teams'][number]

/** What the room needs to see from each team at this stage. Never hints at hidden mechanics. */
function teamStatus(kind: string, t: Team): { done: boolean; text: string } | null {
  switch (kind) {
    case 'diagnose':
      return {
        done: t.priorities > 0,
        text: t.priorities ? `${t.priorities} priorities` : 'Investigating',
      }
    case 'invest_r1':
    case 'simulate_y1':
      return {
        done: t.round1_submitted,
        text: t.round1_submitted ? 'Round 1 submitted' : 'Deciding',
      }
    case 'analyze':
      return {
        done: t.pitch_submitted,
        text: t.pitch_submitted ? 'Pitch ready' : 'Preparing the pitch',
      }
    case 'invest_r2':
    case 'simulate_y2':
      return {
        done: t.round2_submitted,
        text: t.round2_submitted ? 'Round 2 submitted' : 'Deciding',
      }
    case 'operating_model':
      return {
        done: t.opmodel_submitted,
        text: t.opmodel_submitted ? 'Design submitted' : 'Designing',
      }
    case 'crisis':
      if (!t.crisis_event_id) return { done: true, text: 'No crisis' }
      return {
        done: t.crisis_responded,
        text: t.crisis_responded ? 'Response submitted' : 'Responding',
      }
    case 'translate':
      return { done: t.opportunities > 0, text: `${t.opportunities} opportunities` }
    default:
      return null
  }
}

/** T-099: a read-only room view for the projector. No controls, no answer key, no hidden numbers. */
export function ProjectorView() {
  const { sessionId = '' } = useParams()
  const token = auth.facilitator(sessionId)
  const { data: session, isPending } = useSession(sessionId, token)
  useRealtime(token ? sessionId : undefined, token)
  const released = !!session?.options.scorecards_released
  const { data: board } = useScoreboard(sessionId, token, released)
  const [full, setFull] = useState(false)

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  if (!token)
    return (
      <div className="projector projector--center">
        <p>Open the projector view from the facilitator console on this computer.</p>
        <Link to="/">Start page</Link>
      </div>
    )
  if (isPending || !session) return <Loading label="Opening projector view…" />

  const i = session.clock.stage_index
  const stage = session.stages[i]
  const next = session.stages[i + 1]
  const kind = session.clock.stage_kind
  const notStarted = session.clock.status === 'not_started'
  const showBoard = released && board && ['results', 'debrief', 'translate'].includes(kind)
  const top = Math.max(1, ...(board ?? []).map((b) => b.scorecard.total))
  const toggleFull = () =>
    (document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen()
    ).catch(() => undefined)

  return (
    <div className="projector">
      <div className="projector__chrome">
        <button
          type="button"
          onClick={toggleFull}
          aria-label={full ? 'Exit full screen' : 'Full screen'}
        >
          {full ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
        </button>
        <Link to={`/facilitator/${sessionId}`} aria-label="Back to the console">
          <X aria-hidden />
        </Link>
      </div>

      <header className="projector__top">
        <div className="row">
          <div className="brand-mark">MA</div>
          <span className="projector__session">{session.name}</span>
        </div>
        <span className="projector__step">
          {notStarted
            ? 'Starting soon'
            : `${stage.start} · Stage ${i + 1} of ${session.stages.length}`}
        </span>
      </header>

      <main className="projector__main">
        <div className="projector__stage">
          <div className="projector__kicker">{notStarted ? 'Welcome' : stage.title}</div>
          <h1 className="projector__question">
            {notStarted ? 'Join your team on the start page' : stage.executive_question}
          </h1>
          {!notStarted && stage.primary_output && (
            <p className="projector__output">
              <span>By the end:</span> {stage.primary_output}
            </p>
          )}
        </div>
        <div className="projector__clock">
          {!notStarted && <Countdown clock={session.clock} big holdAtZero />}
          {next && !notStarted && (
            <div className="projector__next">
              Next · <span>{next.start}</span> {next.title}
            </div>
          )}
        </div>
      </main>

      {(notStarted || kind === 'briefing') && (
        <section className="projector__teams" aria-label="Join codes">
          {session.teams.map((t) => (
            <div key={t.team_id} className="projector__team">
              <div className="projector__team-name">{t.team_name}</div>
              <div className="projector__code">{t.join_code}</div>
            </div>
          ))}
        </section>
      )}

      {showBoard ? (
        <section className="projector__board" aria-label="Final scorecards">
          {[...board]
            .sort((a, b) => b.scorecard.total - a.scorecard.total)
            .map((b) => (
              <div key={b.team_id} className="projector__bar-row">
                <span className="projector__team-name">{b.team_name}</span>
                <span className="projector__bar">
                  <span style={{ width: `${(b.scorecard.total / top) * 100}%` }} />
                </span>
                <span className="projector__score">{b.scorecard.total.toFixed(0)}</span>
              </div>
            ))}
        </section>
      ) : (
        !notStarted &&
        kind !== 'briefing' && (
          <section className="projector__teams" aria-label="Team progress">
            {session.teams.map((t) => {
              const st = teamStatus(kind, t)
              return (
                <div key={t.team_id} className={`projector__team ${st?.done ? 'is-done' : ''}`}>
                  <div className="projector__team-name">{t.team_name}</div>
                  {st && (
                    <div className="projector__team-status">
                      {st.done && <Check aria-hidden />} {st.text}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )
      )}
      <footer className="projector__foot">
        All organizations, members and data are fictional. Stars values are simulated and
        illustrative.
      </footer>
    </div>
  )
}
