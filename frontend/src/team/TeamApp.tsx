import {
  BookOpen,
  Bot,
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
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useCatalog, useTeam } from '../api/hooks'
import { useRealtime } from '../api/realtime'
import type { TeamView } from '../api/types'
import { Countdown } from '../components/Countdown'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Badge, Empty, Loading } from '../components/ui/primitives'
import { money } from '../lib/format'
import { auth } from '../lib/storage'
import { AnalystPage } from './AnalystPage'
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

  const leave = () => {
    auth.clearTeam()
    navigate('/')
  }

  return (
    <div className="shell">
      <Sidebar team={team} />
      <div className="main">
        <header className="topbar">
          <div
            className="grow row topbar__stage"
            style={{ '--gap': '12px' } as React.CSSProperties}
          >
            <div className="stack" style={{ '--gap': '0px' } as React.CSSProperties}>
              <span className="xs muted upper">
                {team.clock.status === 'not_started'
                  ? 'Waiting to start'
                  : `Stage ${team.clock.stage_index + 1} of ${catalog?.stages.filter((s) => team.include_translation || !s.optional).length ?? 13}`}
              </span>
              <span className="strong">{team.clock.stage_title}</span>
            </div>
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
              aria-label="Leave workspace"
              iconOnly
            />
          </div>
        </header>
        <main className="content">
          {error && !team ? (
            <Empty title="Could not load your workspace">{String(error)}</Empty>
          ) : (
            <Routes>
              <Route index element={<BriefingPage team={team} />} />
              <Route path="primer" element={<PrimerPage team={team} />} />
              <Route path="dataroom" element={<DataRoomPage />} />
              <Route path="analyst" element={<AnalystPage team={team} />} />
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
  )
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
    { group: 'Situation', to: 'analyst', label: 'AI analyst', icon: Bot },
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
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="brand-mark">{team.payer.name.slice(0, 1)}</div>
        <div className="stack grow" style={{ '--gap': '0px' } as React.CSSProperties}>
          <span className="strong" style={{ fontSize: 13.5 }}>
            {team.payer.name}
          </span>
          <span className="xs muted">{team.payer.archetype}</span>
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
                      <span
                        className="pill-dot"
                        style={{ background: 'var(--good)' }}
                        aria-label="done"
                      />
                    )}
                  </span>
                </NavLink>
              ))}
          </div>
        ))}
      </nav>
      <div className="sidebar__footer xs muted">
        {team.session_name}
        <br />
        Simulated data · fictional organizations
      </div>
    </aside>
  )
}
