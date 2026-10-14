import {
  Activity,
  BarChart3,
  BookKey,
  BookOpen,
  Settings,
  KeyRound,
  Lightbulb,
  LogOut,
  MonitorPlay,
  PlayCircle,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useSession } from '../api/hooks'
import { useRealtime } from '../api/realtime'
import { Countdown } from '../components/Countdown'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Field, Input } from '../components/ui/Field'
import { Badge, Callout, Loading } from '../components/ui/primitives'
import { Tabs } from '../components/ui/Tabs'
import { auth } from '../lib/storage'
import { ActivityPanel } from './ActivityPanel'
import { AnswerKeyPanel } from './AnswerKeyPanel'
import { EditionPanel } from './EditionPanel'
import { SessionSettingsPanel } from './SessionSettingsPanel'
import { OpportunityPanel } from './OpportunityPanel'
import { ResultsPanel } from './ResultsPanel'
import { BrandWordmark } from '../components/BrandWordmark'
import { useConfirm } from '../components/ui/toastContext'
import { RunPanel } from './RunPanel'
import { TeamsPanel } from './TeamsPanel'
import type { SessionView } from '../api/types'
import { speak, useStageAnnouncer, useVoiceEnabled, voiceSupported } from './voiceAnnouncer'

type Tab = 'run' | 'teams' | 'key' | 'results' | 'map' | 'activity' | 'edition' | 'settings'

export function FacilitatorConsole() {
  const { sessionId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [token, setToken] = useState(() => {
    const fromLink = params.get('token')
    if (fromLink) auth.setFacilitator(sessionId, fromLink)
    return fromLink ?? auth.facilitator(sessionId)
  })
  useEffect(() => {
    if (params.has('token')) setParams({}, { replace: true }) // keep the token out of the address bar
  }, [params, setParams])
  const [tab, setTab] = useState<Tab>('run')
  const [voice, setVoice] = useVoiceEnabled()
  const { data: session, error, isPending } = useSession(sessionId, token)
  const connected = useRealtime(token ? sessionId : undefined, token)

  if (!token || (error instanceof ApiError && (error.status === 401 || error.status === 403))) {
    return (
      <TokenGate
        sessionId={sessionId}
        onToken={(t) => {
          auth.setFacilitator(sessionId, t)
          setToken(t)
        }}
        invalid={!!error}
      />
    )
  }
  if (isPending || !session) return <Loading label="Opening facilitator console…" />

  return (
    <div className="fac">
      <StageAnnouncer session={session} enabled={voice} />
      {/* Header and tab bar stay pinned together while the page scrolls. */}
      <div className="fac__pinned">
        <header className="fac__top">
          <Link to="/" className="row" style={{ color: 'inherit', textDecoration: 'none' }}>
            <BrandWordmark />
          </Link>
          <div className="grow fac__heading">
            <div className="xs muted upper">Facilitator console</div>
            {session.name !== 'Executive AI Simulation' && (
              <div className="strong">{session.name}</div>
            )}
          </div>
          <div className="row">
            <Countdown clock={session.clock} />
            <Button
              size="sm"
              variant="ghost"
              icon={<MonitorPlay />}
              onClick={() => window.open(`/projector/${session.id}`, 'execsim-projector')}
              title="Open the room view in a new window (drag it to the projector)"
            >
              Projector
            </Button>
            <Badge
              tone={connected ? 'good' : 'warning'}
              icon={connected ? <Wifi aria-hidden /> : <WifiOff aria-hidden />}
            >
              {connected ? 'Live' : 'Offline'}
            </Badge>
            {voiceSupported && (
              <Button
                size="sm"
                variant="ghost"
                icon={voice ? <Volume2 /> : <VolumeX />}
                iconOnly
                aria-pressed={voice}
                aria-label={voice ? 'Turn the voice announcer off' : 'Turn the voice announcer on'}
                title={
                  voice
                    ? 'Voice announcer on: reads each stage and calls out the time'
                    : 'Voice announcer off'
                }
                onClick={() => {
                  setVoice(!voice)
                  if (!voice) speak('Voice announcer on.')
                }}
              />
            )}
            <ThemeToggle />
            <Button
              size="sm"
              variant="ghost"
              icon={<LogOut />}
              aria-label="Leave console"
              title="Leave this console and go back to the start page"
              iconOnly
              onClick={async () => {
                // Leaves this session's console on this device only; the facilitator stays signed in.
                if (
                  await confirm({
                    title: 'Leave this console?',
                    message:
                      "You'll go back to the start page and stay signed in. The session keeps running for the teams; reopen it any time from Facilitate → Sessions.",
                    tone: 'info',
                    confirmLabel: 'Leave console',
                    cancelLabel: 'Stay',
                  })
                ) {
                  auth.clearFacilitator(session.id)
                  navigate('/')
                }
              }}
            />
          </div>
        </header>
        <div className="fac__tabs">
          <Tabs
            label="Console sections"
            value={tab}
            onChange={setTab}
            tabs={[
              {
                id: 'run',
                label: (
                  <>
                    <PlayCircle size={15} aria-hidden /> Run
                  </>
                ),
              },
              {
                id: 'teams',
                label: (
                  <>
                    <Users size={15} aria-hidden /> Teams
                  </>
                ),
              },
              {
                id: 'key',
                label: (
                  <>
                    <BookKey size={15} aria-hidden /> Answer key
                  </>
                ),
              },
              {
                id: 'results',
                label: (
                  <>
                    <BarChart3 size={15} aria-hidden /> Results
                  </>
                ),
              },
              {
                id: 'map',
                label: (
                  <>
                    <Lightbulb size={15} aria-hidden /> Opportunity map
                  </>
                ),
              },
              {
                id: 'activity',
                label: (
                  <>
                    <Activity size={15} aria-hidden /> Activity & exports
                  </>
                ),
              },
              {
                id: 'edition',
                label: (
                  <>
                    <BookOpen size={15} aria-hidden /> Edition
                  </>
                ),
              },
              {
                id: 'settings',
                label: (
                  <>
                    <Settings size={15} aria-hidden /> Session settings
                  </>
                ),
              },
            ]}
          />
        </div>
      </div>
      <main className="content" style={{ maxWidth: 1400 }}>
        {tab === 'run' && <RunPanel session={session} token={token} />}
        {tab === 'teams' && <TeamsPanel session={session} token={token} />}
        {tab === 'key' && <AnswerKeyPanel session={session} token={token} />}
        {tab === 'results' && <ResultsPanel session={session} token={token} />}
        {tab === 'map' && <OpportunityPanel session={session} token={token} />}
        {tab === 'activity' && <ActivityPanel session={session} token={token} />}
        {tab === 'edition' && <EditionPanel session={session} token={token} />}
        {tab === 'settings' && <SessionSettingsPanel session={session} token={token} />}
      </main>
    </div>
  )
}

/** Reads each stage aloud as it starts and calls out the time left (see voiceAnnouncer.ts). */
function StageAnnouncer({ session, enabled }: { session: SessionView; enabled: boolean }) {
  useStageAnnouncer(session, enabled)
  return null
}

function TokenGate({
  sessionId,
  onToken,
  invalid,
}: {
  sessionId: string
  onToken: (t: string) => void
  invalid: boolean
}) {
  const [value, setValue] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (value.trim()) onToken(value.trim())
  }
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <Card
        title={
          <span className="row">
            <KeyRound size={16} aria-hidden /> Facilitator access
          </span>
        }
        subtitle={`Session ${sessionId}`}
        style={{ width: 'min(440px, 100%)' }}
      >
        <form className="stack" onSubmit={submit}>
          {invalid && <Callout tone="critical">That token is not valid for this session.</Callout>}
          <Field
            label="Facilitator token"
            hint="Shown once when the session was created, and stored in this browser."
          >
            {(id) => (
              <Input id={id} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
            )}
          </Field>
          <Button type="submit" variant="primary" block>
            Open console
          </Button>
          <Link to="/" className="small">
            Back to start
          </Link>
        </form>
      </Card>
    </div>
  )
}
