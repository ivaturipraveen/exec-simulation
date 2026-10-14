import { useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Eye,
  EyeOff,
  Gauge,
  Lock,
  Mail,
  Play,
  Presentation,
  Rocket,
  Search,
  Siren,
  Trophy,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { errorMessage, request } from '../api/client'
import logoOnDark from '../assets/brightcone-logo-on-dark.png'
import logoOnLight from '../assets/brightcone-logo-on-light.png'
import { BrandMark } from '../components/BrandMark'
import { authStatusKey, useAuthStatus, type AuthStatus } from '../api/auth'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Loading } from '../components/ui/primitives'
import { auth, signIn } from '../lib/storage'

const STATS = [
  { icon: Building2, value: '3', label: 'Health plans' },
  { icon: Gauge, value: '18', label: 'Investment cards' },
  { icon: Siren, value: '7', label: 'Live crises' },
  { icon: Trophy, value: '2', label: 'Years to win' },
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <div className="login">
      <div className="login__sky" aria-hidden>
        <span className="login__orb login__orb--blue" />
        <span className="login__orb login__orb--mint" />
        <span className="login__grid" />
      </div>

      <header className="login__top">
        <div className="row">
          <BrandMark size={32} />
          <span className="login__product">Executive AI Simulation</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="login__main">
        <section className="login__hero">
          <div className="login__badge">
            <span className="login__badge-pulse" aria-hidden />
            Executive AI Simulation · Medicare Advantage
          </div>
          <h1 className="login__title">
            Your health plan is waiting. <span>Ready to lead?</span>
          </h1>
          <p className="login__lead">
            Step into the C-suite. Read the data room, place scarce capital, survive the crises your
            choices trigger and pitch the board — two simulated years, one leadership team.
          </p>

          <ol className="login__levels" aria-label="How the game unfolds">
            {LEVELS.map(({ icon: Icon, label }, i) => (
              <li key={label} className="login__level" style={{ '--i': i } as React.CSSProperties}>
                <span className="login__level-node">
                  <Icon aria-hidden />
                </span>
                <span className="login__level-text">
                  <span className="login__level-num">Level {i + 1}</span>
                  {label}
                </span>
              </li>
            ))}
          </ol>

          <ul className="list-reset login__stats">
            {STATS.map(({ icon: Icon, value, label }) => (
              <li key={label} className="login__stat">
                <Icon aria-hidden />
                <span className="login__stat-value">{value}</span>
                <span className="login__stat-label">{label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="login__card" aria-labelledby="login-title">
          <div className="login__card-head">
            {/* The card is white in light theme and navy in dark theme: one logo for each. */}
            <img
              className="login__logo login__logo--light"
              src={logoOnLight}
              alt="Brightcone.ai — Clarity. Focus. Impact"
              width={647}
              height={150}
              draggable={false}
            />
            <img
              className="login__logo login__logo--dark"
              src={logoOnDark}
              alt=""
              aria-hidden
              width={647}
              height={150}
              draggable={false}
            />
            <h2 id="login-title" className="login__card-title">
              Player sign-in
            </h2>
            <p className="login__card-sub">Sign in to enter the simulation.</p>
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
              Start the simulation
            </Button>
          </form>

          <p className="login__fine">
            Authorized participants only. All organizations, members and data in the game are
            fictional.
          </p>
        </section>
      </main>
    </div>
  )
}
