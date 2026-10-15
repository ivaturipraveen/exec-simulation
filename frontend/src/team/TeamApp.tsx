import {
  CircleCheck,
  BookOpen,
  ClipboardList,
  FolderSearch,
  GitBranch,
  Lightbulb,
  LineChart,
  LogOut,
  Mic,
  Siren,
  Target,
  Trophy,
  Wallet,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useCatalog, useTeam } from '../api/hooks'
import { useRealtime } from '../api/realtime'
import type { TeamView } from '../api/types'
import { BrandWordmark } from '../components/BrandWordmark'
import { Countdown } from '../components/Countdown'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Badge, Empty, Loading } from '../components/ui/primitives'
import { money, payerSuffix } from '../lib/format'
import { auth } from '../lib/storage'
import { AnalystProvider } from './AnalystDrawer'
import { useAnalyst } from './analystContext'
import { BriefingPage } from './BriefingPage'
import { CrisisPage } from './CrisisPage'
import { DataRoomPage } from './DataRoomPage'
import { DiagnosePage } from './DiagnosePage'
import { InvestPage } from './InvestPage'
import { OperatingModelPage } from './OperatingModelPage'
import { OpportunitiesPage } from './OpportunitiesPage'
import { PitchPage } from './PitchPage'
import { PrimerPage } from './PrimerPage'
import { ResultsPage } from './ResultsPage'
import { ScorecardPage } from './ScorecardPage'

/** Which page is "where the action is" for each stage. */
const STAGE_PAGE: Record<string, string> = {
  briefing: 'primer',
  company: '',
  diagnose: 'diagnose',
  invest_r1: 'invest',
  simulate_y1: 'results',
  analyze: 'pitch',
  invest_r2: 'invest',
  simulate_y2: 'results',
  operating_model: 'operating-model',
  crisis: 'crisis',
  results: 'scorecard',
  debrief: 'scorecard',
  translate: 'opportunities',
}

export function TeamApp() {
  const session = auth.team()
  const { data: team, error, isPending } = useTeam()
  const connected = useRealtime(session?.sessionId, session?.token ?? null, session?.teamId)
  const { data: catalog } = useCatalog()
  const navigate = useNavigate()

  if (!session) return <Navigate to="/" replace />
  if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
    auth.clearTeam()
    return <Navigate to="/" replace />
  }
  if (isPending || !team) return <Loading label="Opening your workspace…" />

  const stageCount =
    catalog?.stages.filter((s) => team.include_translation || !s.optional).length ?? 13
  // How far through the whole game the team is: finished stages plus the running one's share.
  const c = team.clock
  const progress =
    c.status === 'not_started'
      ? 0
      : Math.min(
          100,
          ((c.stage_index + Math.min(1, c.elapsed_seconds / Math.max(1, c.duration_seconds))) /
            stageCount) *
            100,
        )

  const leave = () => {
    auth.clearTeam()
    navigate('/')
  }

  return (
    <AnalystProvider team={team}>
      <div className="shell shell--arena">
        <div className="arena-sky" aria-hidden>
          <span className="arena-sky__orb arena-sky__orb--blue" />
          <span className="arena-sky__orb arena-sky__orb--mint" />
          <span className="arena-sky__grid" />
        </div>
        <Sidebar team={team} />
        <div className="main">
          <header className="topbar">
            <div
              className="grow row topbar__stage"
              style={{ '--gap': '12px' } as React.CSSProperties}
            >
              <span
                className="hud-level"
                title={
                  team.clock.status === 'not_started'
                    ? 'Waiting for the facilitator to start'
                    : `Stage ${team.clock.stage_index + 1} of ${stageCount}`
                }
              >
                {team.clock.status === 'not_started' ? (
                  'Lobby'
                ) : (
                  <>
                    Level <b>{team.clock.stage_index + 1}</b>
                    <span>/{stageCount}</span>
                  </>
                )}
              </span>
              <span className="strong topbar__title">{team.clock.stage_title}</span>
              <Countdown clock={team.clock} />
            </div>
            <div className="row" style={{ '--gap': '12px' } as React.CSSProperties}>
              <span className="badge badge--outline" title="Capital available to commit">
                <Wallet aria-hidden /> <span className="num">{money(team.ledger.available)}</span>{' '}
                available
              </span>
              <span
                className={`badge ${connected ? 'badge--good' : 'badge--warning'}`}
                title={connected ? 'Live updates connected' : 'Reconnecting…'}
              >
                {connected ? <Wifi aria-hidden /> : <WifiOff aria-hidden />}
                {connected ? 'Live' : 'Offline'}
              </span>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                icon={<LogOut />}
                onClick={leave}
                aria-label="Log out"
                title="Log out of this team workspace (rejoin any time with the join code)"
                iconOnly
              />
            </div>
            <span className="hud-progress" aria-hidden>
              <span style={{ width: `${progress}%` }} />
            </span>
          </header>
          <main className="content">
            {error && !team ? (
              <Empty title="Could not load your workspace">{String(error)}</Empty>
            ) : (
              <Routes>
                <Route index element={<BriefingPage team={team} />} />
                <Route path="primer" element={<PrimerPage team={team} />} />
                <Route path="dataroom" element={<DataRoomPage />} />
                <Route path="analyst" element={<OpenAnalyst />} />
                <Route path="diagnose" element={<DiagnosePage team={team} />} />
                <Route path="invest" element={<InvestPage team={team} />} />
                <Route path="pitch" element={<PitchPage team={team} />} />
                <Route path="results" element={<ResultsPage team={team} />} />
                <Route path="operating-model" element={<OperatingModelPage team={team} />} />
                <Route path="crisis" element={<CrisisPage team={team} />} />
                <Route path="scorecard" element={<ScorecardPage team={team} />} />
                <Route path="opportunities" element={<OpportunitiesPage team={team} />} />
                <Route path="*" element={<Navigate to="/team" replace />} />
              </Routes>
            )}
          </main>
        </div>
      </div>
    </AnalystProvider>
  )
}

/** A live feed of the team's own numbers in the sidebar corner, like the lobby's market ticker. */
function TeamTicker({ team }: { team: TeamView }) {
  const p = team.payer
  const feed = [
    { label: 'Stage', value: team.clock.stage_title },
    {
      label: 'Stars (simulated)',
      value: `${p.starting_stars.toFixed(1)}★`,
      delta: `target ${p.target_stars.toFixed(1)}`,
    },
    { label: 'Members', value: p.members.toLocaleString() },
    { label: 'Capital available', value: money(team.ledger.available), good: true },
    { label: 'Committed', value: money(team.ledger.committed) },
    { label: 'Capacity / quarter', value: `${p.capacity_per_quarter} pts` },
    { label: 'Data readiness', value: `${p.data_readiness} / 5` },
    { label: '4-Star bonus', value: money(p.bonus_value_musd, 1), good: true },
    { label: team.session_name, value: 'Simulated data · fictional organizations' },
  ]
  return (
    <div className="team-ticker" aria-hidden>
      <span className="login__ticker-tag">Live · {team.team_name}</span>
      <div className="login__ticker-window">
        {/* two copies back to back, so the loop has no seam */}
        <div className="login__ticker-track">
          {[...feed, ...feed].map((f, i) => (
            <span key={i} className="login__tick">
              <span className="login__tick-label">{f.label}</span>
              <span className="login__tick-value">{f.value}</span>
              {f.delta && <span className="login__tick-delta">{f.delta}</span>}
              {f.good && <span className="login__tick-delta is-good">▲</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Old /team/analyst links: open the analyst panel over the briefing instead. */
function OpenAnalyst() {
  const { openAnalyst } = useAnalyst()
  useEffect(() => openAnalyst(), [openAnalyst])
  return <Navigate to="/team" replace />
}

function Sidebar({ team }: { team: TeamView }) {
  const f = team.flags
  const ws = team.workspace
  const current = team.clock.status === 'not_started' ? null : STAGE_PAGE[team.clock.stage_kind]
  const items: {
    group: string
    to: string
    label: string
    icon: React.ElementType
    enabled?: boolean
    done?: boolean
  }[] = [
    { group: 'Situation', to: '', label: 'Company briefing', icon: BookOpen },
    { group: 'Situation', to: 'primer', label: 'Stars & AI primer', icon: Lightbulb },
    { group: 'Situation', to: 'dataroom', label: 'Data room', icon: FolderSearch },
    {
      group: 'Decisions',
      to: 'diagnose',
      label: 'Diagnose',
      icon: ClipboardList,
      done: ws.priorities.length > 0,
    },
    {
      group: 'Decisions',
      to: 'invest',
      label: 'Invest',
      icon: Target,
      done: !!ws.round1_submitted_at && (f.results_years.length < 1 || !!ws.round2_submitted_at),
    },
    {
      group: 'Decisions',
      to: 'pitch',
      label: 'Board pitch',
      icon: Mic,
      enabled: f.results_years.length > 0,
      done: !!ws.pitch_submitted_at,
    },
    {
      group: 'Decisions',
      to: 'results',
      label: 'Results',
      icon: LineChart,
      enabled: f.results_years.length > 0,
    },
    {
      group: 'Decisions',
      to: 'operating-model',
      label: 'Operating model',
      icon: GitBranch,
      enabled: f.can_edit_opmodel || !!ws.opmodel_submitted_at,
      done: !!ws.opmodel_submitted_at,
    },
    {
      group: 'Decisions',
      to: 'crisis',
      label: 'Crisis',
      icon: Siren,
      enabled: !!ws.crisis_event_id,
      done: !!ws.crisis_response,
    },
    {
      group: 'Outcome',
      to: 'scorecard',
      label: 'Scorecard',
      icon: Trophy,
      enabled: f.scorecard_available,
    },
    {
      group: 'Outcome',
      to: 'opportunities',
      label: 'Opportunity map',
      icon: Lightbulb,
      enabled: f.can_capture_opportunities,
    },
  ]
  const groups = [...new Set(items.map((i) => i.group))]
  const missions = items.filter((i) => i.done !== undefined)
  const missionsDone = missions.filter((i) => i.done).length
  const archetype = [payerSuffix(team.team_name, team.payer.name), team.payer.archetype]
    .filter(Boolean)
    .join(' · ')
  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <BrandWordmark followTheme height={30} />
      </div>
      <div className="sidebar__brand">
        <div className="brand-mark">{team.team_name.slice(0, 1).toUpperCase()}</div>
        <div className="stack grow" style={{ '--gap': '0px' } as React.CSSProperties}>
          {/* The team name is shown once, in the live ticker at the foot of the sidebar. */}
          <span className="sidebar__room">Boardroom</span>
          <span className="sidebar__archetype" title={archetype}>
            {archetype}
          </span>
        </div>
      </div>
      <nav className="sidebar__nav" aria-label="Workspace">
        {groups.map((g) => (
          <div className="nav-group" key={g}>
            <div className="nav-group__label">{g}</div>
            {items
              .filter((i) => i.group === g)
              .map(({ to, label, icon: Icon, enabled = true, done }) => (
                <NavLink
                  key={to}
                  to={`/team/${to}`}
                  end={to === ''}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  aria-disabled={!enabled}
                  tabIndex={enabled ? undefined : -1}
                >
                  <Icon aria-hidden />
                  <span>{label}</span>
                  <span className="nav-item__end">
                    {current === to && <Badge tone="accent">Now</Badge>}
                    {current !== to && done && (
                      <CircleCheck className="nav-item__done" aria-label="submitted" />
                    )}
                  </span>
                </NavLink>
              ))}
          </div>
        ))}
      </nav>
      <div className="mission" title="Decisions your team has submitted">
        <div className="mission__head">
          <Trophy aria-hidden /> Mission progress
          <b>
            {missionsDone}/{missions.length}
          </b>
        </div>
        <div className="mission__bar" aria-hidden>
          <span style={{ width: `${(missionsDone / Math.max(1, missions.length)) * 100}%` }} />
        </div>
      </div>
      <div className="sidebar__footer">
        <TeamTicker team={team} />
      </div>
    </aside>
  )
}
