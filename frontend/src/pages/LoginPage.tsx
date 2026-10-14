import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Eye,
  EyeOff,
  Gauge,
  Lock,
  LockKeyhole,
  Mail,
  MonitorPlay,
  Play,
  Presentation,
  Rocket,
  Search,
  ShieldCheck,
  Siren,
  Trophy,
  Users,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { errorMessage, request } from '../api/client'
import { authStatusKey, useAuthStatus, type AuthStatus } from '../api/auth'
import { BrandLogo as Logo } from '../components/BrandLogo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Loading } from '../components/ui/primitives'
import { auth, signIn } from '../lib/storage'

/** Text and layout of this page, edited under Settings → Sign-in page (GET /auth/page). */
export interface LoginPageConfig {
  layout: 'hero-left' | 'hero-right' | 'centered'
  logo: 'header' | 'card' | 'both'
  badge: string
  title: string
  title_accent: string
  lead: string
  card_title: string
  card_subtitle: string
  button: string
  footnote: string
  show_levels: boolean
  show_stats: boolean
  show_ticker: boolean
}

/** Same as the server defaults; used until the page config arrives or if it cannot be loaded. */
const DEFAULT_PAGE: LoginPageConfig = {
  layout: 'hero-left',
  logo: 'header',
  badge: 'Executive AI Simulation · Medicare Advantage',
  title: 'Your health plan is waiting.',
  title_accent: 'Ready to lead?',
  lead: 'Step into the C-suite. Read the data room, place scarce capital, survive the crises your choices trigger and pitch the board — two simulated years, one leadership team.',
  card_title: 'Sign in',
  card_subtitle:
    "Use the email and password from your invitation. We'll take you to the right place.",
  button: 'Start the simulation',
  footnote:
    'Authorized participants only. All organizations, members and data in the game are fictional.',
  show_levels: true,
  show_stats: true,
  show_ticker: true,
}

function useLoginPage(): LoginPageConfig {
  const { data } = useQuery({
    queryKey: ['login-page'],
    queryFn: () => request<LoginPageConfig>('GET', '/auth/page'),
    staleTime: 5 * 60_000,
    retry: false,
  })
  return { ...DEFAULT_PAGE, ...data }
}

const STATS = [
  { icon: Building2, value: '3', label: 'Health plans' },
  { icon: Gauge, value: '18', label: 'Investment cards' },
  { icon: Siren, value: '7', label: 'Live crises' },
  { icon: Trophy, value: '2', label: 'Years to win' },
]

/** Fictional market signals for the ticker along the bottom (decoration; the game's data is in the data room). */
const FEED = [
  { label: 'Medical loss ratio', value: '87.4%', delta: '+0.6', good: false },
  { label: 'Star rating', value: '3.5★', delta: '−0.5', good: false },
  { label: 'Members', value: '412K', delta: '+2.1%', good: true },
  { label: 'Disenrollment', value: '11.2%', delta: '+1.4', good: false },
  { label: 'Risk score (RAF)', value: '1.08', delta: '+0.02', good: true },
  { label: 'Prior-auth backlog', value: '6.3K', delta: '+18%', good: false },
  { label: 'Admin cost / PMPM', value: '$41', delta: '−$3', good: true },
  { label: 'CMS audit', value: 'Alert', delta: 'RADV', good: false },
  { label: 'Capital available', value: '$40M', delta: 'Round 1', good: true },
]

const LEVELS = [
  { icon: Search, label: 'Diagnose' },
  { icon: Gauge, label: 'Invest' },
  { icon: Presentation, label: 'Pitch' },
  { icon: Rocket, label: 'Lead' },
]

/** Only same-site paths are allowed as the post-sign-in destination. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export function LoginPage() {
  const { data, isPending } = useAuthStatus()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  if (isPending) return <Loading />
  if (data && (!data.required || data.signed_in)) {
    // Team accounts enter their join code on the start page next.
    const to = data.role === 'team' ? '/' : next
    return <Navigate to={to} replace />
  }
  return <LoginScreen />
}

function LoginScreen() {
  const queryClient = useQueryClient()
  const page = useLoginPage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logoInHeader = page.logo !== 'card'
  const logoInCard = page.logo !== 'header'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { token, ...status } = await request<AuthStatus & { token: string }>(
        'POST',
        '/auth/login',
        { body: { email: email.trim(), password } },
      )
      signIn.set(token)
      // A team signs in afresh and then proves its team with the join code.
      if (status.role === 'team') auth.clearTeam()
      // Signed in: LoginPage redirects to the right page.
      queryClient.setQueryData(authStatusKey, status)
    } catch (err) {
      setError(errorMessage(err))
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`login login--${page.layout}`}>
      <div className="login__sky" aria-hidden>
        <span className="login__orb login__orb--blue" />
        <span className="login__orb login__orb--mint" />
        <span className="login__grid" />
      </div>

      <header className="login__top">
        {logoInHeader ? <Logo className="login__logo--header" label /> : <span />}
        <ThemeToggle />
      </header>

      <main className="login__main">
        <section className="login__intro">
          {page.badge && (
            <div className="login__badge">
              <span className="login__badge-pulse" aria-hidden />
              {page.badge}
            </div>
          )}
          <h1 className="login__title">
            {page.title} {page.title_accent && <span>{page.title_accent}</span>}
          </h1>
          {page.lead && <p className="login__lead">{page.lead}</p>}
        </section>

        {(page.show_levels || page.show_stats) && (
          <section className="login__extras" aria-label="How the game unfolds">
            {page.show_levels && (
              <ol className="login__levels">
                {LEVELS.map(({ icon: Icon, label }, i) => (
                  <li
                    key={label}
                    className={`login__level ${i === 0 ? 'is-current' : 'is-locked'}`}
                    style={{ '--i': i } as React.CSSProperties}
                  >
                    <span className="login__level-node">
                      <Icon aria-hidden />
                      {i > 0 && (
                        <span className="login__level-lock">
                          <LockKeyhole aria-hidden />
                        </span>
                      )}
                    </span>
                    <span className="login__level-text">
                      <span className="login__level-num">
                        {i === 0 ? 'Start here' : `Level ${i + 1}`}
                      </span>
                      {label}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {page.show_stats && (
              <ul className="list-reset login__stats">
                {STATS.map(({ icon: Icon, value, label }) => (
                  <li key={label} className="login__stat">
                    <Icon aria-hidden />
                    <span className="login__stat-value">{value}</span>
                    <span className="login__stat-label">{label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="login__card" aria-labelledby="login-title">
          <div className="login__card-bar" aria-hidden>
            <span className="login__card-status">
              <ShieldCheck /> Secure channel
            </span>
            <span>Analyst terminal</span>
          </div>
          <div className="login__card-head">
            {logoInCard && <Logo className="login__logo--card" label={!logoInHeader} />}
            <span className="login__card-kicker">Access terminal · ready</span>
            <h2 id="login-title" className="login__card-title">
              {page.card_title}
            </h2>
            {page.card_subtitle && <p className="login__card-sub">{page.card_subtitle}</p>}
            <ul className="list-reset login__roles" aria-label="Who signs in here">
              <li>
                <Users aria-hidden /> Players <span>Team workspace</span>
              </li>
              <li>
                <MonitorPlay aria-hidden /> Facilitators <span>Session console</span>
              </li>
            </ul>
          </div>

          <form className="login__form" onSubmit={submit} noValidate>
            <label className="login__field">
              <span className="login__label">Email</span>
              <span className="login__input-wrap">
                <Mail aria-hidden />
                <input
                  className="login__input"
                  type="email"
                  name="email"
                  autoComplete="username"
                  inputMode="email"
                  placeholder="you@brightcone.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!error}
                  autoFocus
                  required
                />
              </span>
            </label>
            <label className="login__field">
              <span className="login__label">Password</span>
              <span className="login__input-wrap">
                <Lock aria-hidden />
                <input
                  className="login__input"
                  type={show ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!error}
                  required
                />
                <button
                  type="button"
                  className="login__peek"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  title={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </button>
              </span>
            </label>

            {error && (
              <p className="login__error" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              loading={busy}
              disabled={!email.trim() || !password}
              icon={<Play />}
              className="login__start"
            >
              {page.button}
            </Button>
          </form>

          {page.footnote && <p className="login__fine">{page.footnote}</p>}
        </section>
      </main>

      {page.show_ticker && (
        <div className="login__ticker" aria-hidden>
          <span className="login__ticker-tag">Live feed</span>
          <div className="login__ticker-window">
            {/* two copies back to back, so the loop has no seam */}
            <div className="login__ticker-track">
              {[...FEED, ...FEED].map((f, i) => (
                <span key={i} className="login__tick">
                  <span className="login__tick-label">{f.label}</span>
                  <span className="login__tick-value">{f.value}</span>
                  <span className={`login__tick-delta ${f.good ? 'is-good' : 'is-bad'}`}>
                    {f.delta}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
