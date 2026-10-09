import {
  ArrowRight,
  Building2,
  Clock4,
  LineChart,
  Presentation,
  ShieldCheck,
  Siren,
  Users,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage, request } from '../api/client'
import { useCatalog } from '../api/hooks'
import type { CreatedSession, JoinResult } from '../api/types'
import { Button } from '../components/ui/Button'
import { Field, Input, Select } from '../components/ui/Field'
import { Callout } from '../components/ui/primitives'
import { Tabs } from '../components/ui/Tabs'
import { ThemeToggle } from '../components/ThemeToggle'
import { auth } from '../lib/storage'

const FEATURES = [
  {
    icon: Building2,
    title: 'Three asymmetric health plans',
    text: 'A PE-backed challenger, a 15-year incumbent and a provider-sponsored plan — each with three hidden root causes in a 30-file data room.',
  },
  {
    icon: LineChart,
    title: '18 cards, conditional effects',
    text: 'Payer fit, prerequisites, adoption, capacity and diminishing returns decide what lands. Leading KPIs move first; Stars follow a rating year later.',
  },
  {
    icon: Siren,
    title: 'Crises your choices trigger',
    text: 'Seven events, fired by your portfolio. Containment, ownership and honesty are scored; concealment scores zero.',
  },
  {
    icon: ShieldCheck,
    title: 'Governance as a mechanic',
    text: 'Decide where humans decide, AI assists and agents act. Controls, adoption and recoverability score — autonomy alone does not.',
  },
]

export function Landing() {
  const [tab, setTab] = useState<'join' | 'run'>('join')
  const { data: catalog } = useCatalog()
  const core = catalog?.stages.filter((s) => !s.optional) ?? []
  const optional = catalog?.stages.find((s) => s.optional)
  const coreMinutes = core.reduce((n, s) => n + s.duration_minutes, 0)
  return (
    <div className="landing">
      <header className="landing__top">
        <div className="row">
          <div className="brand-mark">MA</div>
          <span className="strong">Executive AI Simulation</span>
        </div>
        <div className="row">
          <Link to="/settings" className="btn btn--ghost btn--sm">
            Settings
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="landing__main">
        <section className="landing__hero">
          <div className="page-header__eyebrow">Medicare Advantage · Leadership workshop</div>
          <h1 className="landing__title">Lead a health plan through its AI transformation.</h1>
          <p className="landing__lead">
            Diagnose an ambiguous data room with an AI analyst, place scarce capital, live with
            delayed Stars and business consequences, then translate what you learned into an AI
            Opportunity Map for your own organization.
          </p>
          <ul className="list-reset landing__features">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="row"
                style={{ alignItems: 'flex-start', '--gap': '12px' } as React.CSSProperties}
              >
                <span className="landing__feature-icon">
                  <Icon aria-hidden />
                </span>
                <div>
                  <div className="strong">{title}</div>
                  <div className="secondary small">{text}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="agenda" aria-label="Run of show">
            <span className="upper muted row" style={{ '--gap': '6px' } as React.CSSProperties}>
              <Clock4 size={13} aria-hidden /> {coreMinutes} minutes
              {optional &&
                ` + optional ${optional.duration_minutes}-minute ${optional.title.split(' (')[0].toLowerCase()}`}
            </span>
            <ol className="agenda__list">
              {core
                .filter((s) => !['simulate_y1', 'simulate_y2', 'results'].includes(s.kind))
                .map((s) => (
                  <li key={s.id}>
                    <span className="num">{s.start}</span>
                    {s.title.replace(' and briefing', '').replace(' (break)', '')}
                  </li>
                ))}
            </ol>
          </div>
        </section>
        <section className="card landing__panel" aria-label="Get started">
          <div style={{ padding: '6px 20px 0' }}>
            <Tabs
              label="Get started"
              value={tab}
              onChange={setTab}
              tabs={[
                {
                  id: 'join',
                  label: (
                    <>
                      <Users size={15} aria-hidden /> Join your team
                    </>
                  ),
                },
                {
                  id: 'run',
                  label: (
                    <>
                      <Presentation size={15} aria-hidden /> Facilitate
                    </>
                  ),
                },
              ]}
            />
          </div>
          <div className="card__body">{tab === 'join' ? <JoinForm /> : <RunForm />}</div>
        </section>
      </main>
      <footer className="landing__footer muted small">
        All organizations, members and data are fictional. Stars values are simulated and
        illustrative.
      </footer>
    </div>
  )
}

function JoinForm() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const existing = auth.team()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await request<JoinResult>('POST', '/join', { body: { code: code.trim() } })
      auth.setTeam({
        token: r.token,
        teamId: r.team_id,
        sessionId: r.session_id,
        teamName: r.team_name,
        payerName: r.payer_name,
      })
      navigate('/team')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack" style={{ '--gap': '16px' } as React.CSSProperties} onSubmit={submit}>
      <p className="secondary">
        Enter the six-character code your facilitator shared for your team.
      </p>
      <Field label="Team join code" error={error}>
        {(id) => (
          <Input
            id={id}
            className="input--code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            autoComplete="off"
            autoFocus
            placeholder="ABC123"
            aria-invalid={!!error}
          />
        )}
      </Field>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        block
        loading={busy}
        disabled={code.trim().length < 4}
        icon={<ArrowRight />}
      >
        Enter workspace
      </Button>
      {existing && (
        <Button variant="ghost" block onClick={() => navigate('/team')}>
          Continue as {existing.teamName}
        </Button>
      )}
    </form>
  )
}

function RunForm() {
  const navigate = useNavigate()
  const [name, setName] = useState('Executive AI Simulation')
  const [mechanic, setMechanic] = useState('')
  const [mode, setMode] = useState('')
  const { data: catalog } = useCatalog()
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [names, setNames] = useState<Record<string, string>>({})
  const payers = catalog?.payers ?? []
  const chosen = payers.filter((p) => picked[p.id] !== false)
  // Deterministic runs use each card's midpoint, so the seed only matters in Variable mode.
  const variable = (mode || catalog?.rules.sim_mode) === 'variable'
  const [seed, setSeed] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const known = auth.knownSessions()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await request<CreatedSession>('POST', '/sessions', {
        body: {
          name,
          round2_mechanic: mechanic || null,
          seed: variable && seed ? Number(seed) : null,
          sim_mode: mode || null,
          payer_ids: chosen.map((p) => p.id),
          team_names: Object.fromEntries(
            chosen.filter((p) => names[p.id]?.trim()).map((p) => [p.id, names[p.id].trim()]),
          ),
        },
      })
      auth.setFacilitator(r.session.id, r.facilitator_token)
      navigate(`/facilitator/${r.session.id}`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <form className="stack" style={{ '--gap': '14px' } as React.CSSProperties} onSubmit={submit}>
        <Field label="Session name">
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
            />
          )}
        </Field>
        <div className="run-options">
          <Field label="Round 2 capital" hint="How Year-2 capital is allocated">
            {(id) => (
              <Select id={id} value={mechanic} onChange={(e) => setMechanic(e.target.value)}>
                <option value="">{catalog?.rules.round2_mechanic ?? '…'} (default)</option>
                <option value="hybrid">Hybrid: base + capital earned at the pitch</option>
                <option value="fixed">Fixed: the same base for every team</option>
                <option value="differentiated">Differentiated by Year 1 rank (playtest)</option>
              </Select>
            )}
          </Field>
          <Field label="Mode" hint="Deterministic for comparable runs (V1)">
            {(id) => (
              <Select id={id} value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="">{catalog?.rules.sim_mode ?? '…'} (default)</option>
                <option value="deterministic">Deterministic</option>
                <option value="variable">Variable (replay)</option>
              </Select>
            )}
          </Field>
          <Field
            label="Scenario seed"
            hint={
              variable ? 'Same seed → same random draws, for replays' : 'Only used in Variable mode'
            }
          >
            {(id) => (
              <Input
                id={id}
                value={variable ? seed : ''}
                placeholder={variable ? 'Default' : 'Not used'}
                disabled={!variable}
                onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
              />
            )}
          </Field>
        </div>
        <fieldset className="assign">
          <legend className="field__label">Teams and companies</legend>
          {payers.map((p) => (
            <div key={p.id} className="assign__row">
              <label className="checkbox small">
                <input
                  type="checkbox"
                  checked={picked[p.id] !== false}
                  onChange={(e) => setPicked({ ...picked, [p.id]: e.target.checked })}
                />
                <span>
                  <span className="strong">{p.name}</span>{' '}
                  <span className="muted xs assign__sub">{p.archetype}</span>
                </span>
              </label>
              <Input
                aria-label={`Team name for ${p.name}`}
                placeholder="Team name (optional)"
                value={names[p.id] ?? ''}
                maxLength={80}
                disabled={picked[p.id] === false}
                onChange={(e) => setNames({ ...names, [p.id]: e.target.value })}
              />
            </div>
          ))}
        </fieldset>
        {error && <Callout tone="critical">{error}</Callout>}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          disabled={chosen.length === 0}
          loading={busy}
          icon={<ArrowRight />}
        >
          Create session
        </Button>
      </form>
      {known.length > 0 && (
        <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
          <div className="upper muted">Resume a session</div>
          {known.map((id) => (
            <Button
              key={id}
              variant="ghost"
              onClick={() => navigate(`/facilitator/${id}`)}
              className="landing__resume"
            >
              Session {id}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
