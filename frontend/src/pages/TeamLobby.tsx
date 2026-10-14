import {
  DoorOpen,
  Gauge,
  KeyRound,
  LockKeyhole,
  Presentation,
  Rocket,
  Search,
  Ticket,
} from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { joinTeam } from '../api/auth'
import { errorMessage } from '../api/client'
import { BrandLogo } from '../components/BrandLogo'
import { SignOutButton } from '../components/SignOutButton'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'

const CODE_LENGTH = 6

const LEVELS = [
  { icon: Search, label: 'Diagnose' },
  { icon: Gauge, label: 'Invest' },
  { icon: Presentation, label: 'Pitch' },
  { icon: Rocket, label: 'Lead' },
]

/**
 * The team's lobby after signing in: same world as the sign-in page, with a "boarding pass"
 * that takes the six-character join code shown on the facilitator's projector.
 */
export function TeamLobby({ teamName }: { teamName: string }) {
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [focused, setFocused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await joinTeam(code)
      navigate('/team')
    } catch (err) {
      setError(errorMessage(err))
      input.current?.select()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login login--hero-left lobby">
      <div className="login__sky" aria-hidden>
        <span className="login__orb login__orb--blue" />
        <span className="login__orb login__orb--mint" />
        <span className="login__grid" />
      </div>

      <header className="login__top">
        <BrandLogo className="login__logo--header" label />
        <div className="row">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <main className="login__main">
        <section className="login__intro">
          <div className="login__badge">
            <span className="login__badge-pulse" aria-hidden />
            Team lobby · {teamName}
          </div>
          <h1 className="login__title">
            Your boardroom is ready. <span>Take your seats.</span>
          </h1>
          <p className="login__lead">
            Your facilitator has your team&apos;s six-character code on the screen. Enter it to
            unlock your company&apos;s data room, capital and clock.
          </p>
        </section>

        <section className="login__extras" aria-label="How the game unfolds">
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
        </section>

        <section className="login__card lobby__pass" aria-labelledby="lobby-title">
          <div className="login__card-bar" aria-hidden>
            <span className="login__card-status">
              <Ticket /> Boarding pass
            </span>
            <span>Seat · {teamName}</span>
          </div>
          <div className="login__card-head">
            <span className="login__card-kicker">Team access · awaiting code</span>
            <h2 id="lobby-title" className="login__card-title">
              Enter your team code
            </h2>
            <p className="login__card-sub">Six letters and numbers, from your facilitator.</p>
          </div>

          <form className="login__form" onSubmit={submit} noValidate>
            <label className="lobby__code" data-focused={focused || undefined}>
              <span className="sr-only">Team join code</span>
              <input
                ref={input}
                className="lobby__code-input"
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, CODE_LENGTH),
                  )
                }
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                maxLength={CODE_LENGTH}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                autoFocus
                aria-invalid={!!error}
                aria-describedby={error ? 'lobby-error' : undefined}
              />
              {Array.from({ length: CODE_LENGTH }, (_, i) => (
                <span
                  key={i}
                  aria-hidden
                  className={[
                    'lobby__cell',
                    code[i] ? 'is-filled' : '',
                    focused && i === Math.min(code.length, CODE_LENGTH - 1) ? 'is-active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {code[i] ?? ''}
                </span>
              ))}
            </label>

            {error && (
              <p className="login__error" id="lobby-error" role="alert">
                <KeyRound aria-hidden /> {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              loading={busy}
              disabled={code.length < CODE_LENGTH}
              icon={<DoorOpen />}
              className="login__start"
            >
              Enter the boardroom
            </Button>
          </form>

          <p className="login__fine">
            Only your own team&apos;s code opens your workspace. Ask your facilitator if it does not
            work.
          </p>
        </section>
      </main>
    </div>
  )
}
