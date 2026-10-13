import {
  ArrowLeft,
  BadgeCheck,
  ClipboardCheck,
  ExternalLink,
  KeyRound,
  LogOut,
  RotateCcw,
  Save,
  Server,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, errorMessage, request } from '../api/client'
import type { ReviewEntry, SessionRow, SettingView, SettingsView } from '../api/types'
import { BrandMark } from '../components/BrandMark'
import { ThemeToggle } from '../components/ThemeToggle'
import { SettingControl } from '../components/SettingControl'
import { formatSetting } from '../lib/settings'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Field, Input, Textarea } from '../components/ui/Field'
import { Badge, Callout, Empty, Loading } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'
import { adminAuth, auth } from '../lib/storage'

const GROUP_ORDER = [
  'Session defaults',
  'Facilitation',
  'AI analyst',
  'Model parameters',
  'Scorecard',
  'Pilot targets',
]
const SPECIAL = ['Content review', 'Sessions', 'System'] as const
type Section = string

const SOURCE_LABEL: Record<string, string> = {
  content: 'content/game.yaml',
  env: 'backend/.env',
  ui: 'Saved here',
}

const GROUP_ICON: Record<string, typeof SlidersHorizontal> = {
  'Session defaults': Settings2,
  Facilitation: Timer,
  'AI analyst': Sparkles,
  'Model parameters': SlidersHorizontal,
  Scorecard: Trophy,
  'Pilot targets': Target,
}

export function SettingsPage() {
  const [token, setToken] = useState<string | null>(() => adminAuth.get())
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    request<{ enabled: boolean }>('GET', '/admin/status')
      .then((r) => setEnabled(r.enabled))
      .catch(() => setEnabled(false))
  }, [])
  return (
    <div className="settings">
      <header className="settings__top">
        <Link to="/" className="row" style={{ color: 'inherit', textDecoration: 'none' }}>
          <BrandMark />
          <span className="strong">Executive AI Simulation</span>
        </Link>
        <span className="grow" />
        <ThemeToggle />
        {token && (
          <Button
            variant="ghost"
            size="sm"
            icon={<LogOut />}
            onClick={() => {
              adminAuth.clear()
              setToken(null)
            }}
            aria-label="Log out"
            title="Log out of Settings"
            iconOnly
          />
        )}
      </header>
      {enabled === null ? (
        <Loading />
      ) : !enabled ? (
        <div className="settings__gate">
          <Card title="Settings are disabled">
            <p className="secondary">
              Set <code>ADMIN_PASSWORD</code> in <code>backend/.env</code> and restart the app to
              manage settings here. Every setting can also be configured in{' '}
              <code>backend/.env</code> and <code>content/game.yaml</code>.
            </p>
          </Card>
        </div>
      ) : token ? (
        <SettingsWorkspace
          token={token}
          onExpired={() => {
            adminAuth.clear()
            setToken(null)
          }}
        />
      ) : (
        <Login
          onToken={(t) => {
            adminAuth.set(t)
            setToken(t)
          }}
        />
      )}
    </div>
  )
}

function Login({ onToken }: { onToken: (t: string) => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await request<{ token: string }>('POST', '/admin/login', { body: { password } })
      onToken(r.token)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="settings__gate">
      <Card
        title={
          <span className="row">
            <KeyRound size={16} aria-hidden /> Settings
          </span>
        }
        subtitle="Enter the ADMIN_PASSWORD from backend/.env"
      >
        <form className="stack" onSubmit={submit}>
          {error && <Callout tone="critical">{error}</Callout>}
          <Field label="Admin password">
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            )}
          </Field>
          <Button type="submit" variant="primary" block loading={busy} disabled={!password}>
            Open settings
          </Button>
        </form>
      </Card>
    </div>
  )
}

function SettingsWorkspace({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [view, setView] = useState<SettingsView | null>(null)
  const [section, setSection] = useState<Section>('Session defaults')
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = async () => {
    try {
      setView(await request<SettingsView>('GET', '/admin/settings', { token }))
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) onExpired()
      else toast(errorMessage(e), 'error')
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const groups = useMemo(() => {
    const by = new Map<string, SettingView[]>()
    for (const f of view?.fields ?? []) by.set(f.group, [...(by.get(f.group) ?? []), f])
    return by
  }, [view])

  if (!view) return <Loading label="Loading settings…" />
  const pending = Object.keys(draft).length
  const save = async () => {
    setSaving(true)
    try {
      const next = await request<SettingsView>('PUT', '/admin/settings', {
        token,
        body: { values: draft },
      })
      setView(next)
      setDraft({})
      toast(`Saved ${pending} setting${pending === 1 ? '' : 's'}`)
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }
  const reset = async (key: string) => {
    try {
      setView(
        await request<SettingsView>('DELETE', `/admin/settings/${encodeURIComponent(key)}`, {
          token,
        }),
      )
      setDraft((d) => {
        const next = { ...d }
        delete next[key]
        return next
      })
      toast('Reset to the backend/.env / content value')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }
  const openReview = view.review.filter((r) => r.status === 'open').length

  return (
    <div className="settings__body">
      <nav className="settings__nav" aria-label="Settings sections">
        <div className="upper muted settings__nav-label">Configuration</div>
        {GROUP_ORDER.filter((g) => groups.has(g)).map((g) => (
          <button
            key={g}
            type="button"
            className={`settings__nav-item ${section === g ? 'is-active' : ''}`}
            onClick={() => {
              setSection(g)
              window.scrollTo(0, 0)
            }}
          >
            {(() => {
              const Icon = GROUP_ICON[g] ?? SlidersHorizontal
              return <Icon aria-hidden />
            })()}
            <span className="settings__nav-text">{g}</span>
            {(groups.get(g) ?? []).some((f) => f.source === 'ui') && (
              <span
                className="pill-dot"
                style={{ background: 'var(--accent)' }}
                aria-label="has saved overrides"
              />
            )}
          </button>
        ))}
        <div className="upper muted settings__nav-label">Workshop</div>
        {SPECIAL.map((g) => (
          <button
            key={g}
            type="button"
            className={`settings__nav-item ${section === g ? 'is-active' : ''}`}
            onClick={() => {
              setSection(g)
              window.scrollTo(0, 0)
            }}
          >
            {g === 'Content review' ? (
              <ClipboardCheck aria-hidden />
            ) : g === 'Sessions' ? (
              <ExternalLink aria-hidden />
            ) : (
              <Server aria-hidden />
            )}
            <span className="settings__nav-text">{g}</span>
            {g === 'Content review' && openReview > 0 && <Badge tone="warning">{openReview}</Badge>}
          </button>
        ))}
      </nav>
      <main className="settings__main">
        {groups.has(section) && (
          <GroupEditor
            title={section}
            fields={groups.get(section)!}
            draft={draft}
            setDraft={setDraft}
            onReset={reset}
          />
        )}
        {section === 'Content review' && (
          <ReviewEditor token={token} entries={view.review} onView={setView} />
        )}
        {section === 'Sessions' && <SessionsList token={token} />}
        {section === 'System' && <SystemCard view={view} />}
      </main>
      {pending > 0 && (
        <div className="settings__savebar" role="status">
          <span>
            <strong>{pending}</strong> unsaved change{pending === 1 ? '' : 's'}
          </span>
          <Button variant="ghost" onClick={() => setDraft({})}>
            Discard
          </Button>
          <Button variant="primary" icon={<Save />} loading={saving} onClick={save}>
            Save changes
          </Button>
        </div>
      )}
    </div>
  )
}

const GROUP_INTRO: Record<string, string> = {
  'Session defaults':
    'Defaults for new sessions. Each session keeps a snapshot, so changes never shift a workshop already under way. Facilitators can adjust a session from its console (Session tab).',
  Facilitation: 'Console behaviour and the board pitch.',
  'AI analyst': 'Applies immediately. The API key stays in backend/.env (never stored here).',
  'Model parameters':
    'Content Pack §5. Changes apply to new sessions; use `make calibrate` to see their effect on the reference portfolios.',
  Scorecard: 'Content Pack §10.1. The five dimension weights must sum to 100%.',
  'Pilot targets': 'Docx §21 success indicators shown on the Activity tab.',
}

function GroupEditor({
  title,
  fields,
  draft,
  setDraft,
  onReset,
}: {
  title: string
  fields: SettingView[]
  draft: Record<string, unknown>
  setDraft: (fn: (d: Record<string, unknown>) => Record<string, unknown>) => void
  onReset: (key: string) => void
}) {
  const weightKeys = fields.filter((f) => f.key.startsWith('score_weights.'))
  const weightSum = weightKeys.reduce(
    (n, f) => n + Number(f.key in draft ? draft[f.key] : f.value),
    0,
  )
  const weightsOk = Math.abs(weightSum - 1) < 0.001
  const edited = fields.filter((f) => f.key in draft).length
  return (
    <section className="card ss-panel" aria-label={title}>
      <header className="ss-panel__head">
        <div>
          <h1 className="ss-panel__title">{title}</h1>
          {GROUP_INTRO[title] && <p className="ss-panel__intro">{GROUP_INTRO[title]}</p>}
        </div>
        <span className="ss-panel__count">
          {edited > 0
            ? `${edited} edited`
            : `${fields.length} setting${fields.length === 1 ? '' : 's'}`}
        </span>
      </header>
      {weightKeys.length > 0 && (
        <div className={`ss-panel__check ${weightsOk ? 'is-ok' : 'is-bad'}`}>
          Dimension weights total {Math.round(weightSum * 1000) / 10}%
          {weightsOk ? ' · balanced' : ' · adjust to 100% before saving'}
        </div>
      )}
      <ul className="list-reset ss-grid">
        {fields.map((f) => {
          const changed = f.key in draft
          const value = changed ? draft[f.key] : f.value
          const wide = f.kind === 'text' || f.kind === 'enum'
          return (
            <li
              key={f.key}
              className={`ss-field ${changed ? 'is-changed' : ''} ${f.kind === 'bool' ? 'is-bool' : ''} ${wide ? 'is-wide' : ''}`}
            >
              <div className="ss-field__text">
                <label className="ss-field__label" htmlFor={`setting-${f.key}`}>
                  {f.label}
                </label>
                {f.help && <p className="ss-field__help">{f.help}</p>}
              </div>
              <div className="ss-field__control">
                <SettingControl
                  spec={f}
                  value={value}
                  onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                />
                {f.kind === 'bool' && (
                  <span className="setting-tile__state">{value ? 'On' : 'Off'}</span>
                )}
                {f.source === 'ui' && !changed && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<RotateCcw />}
                    onClick={() => onReset(f.key)}
                    aria-label={`Reset ${f.label} to its default`}
                    title={`Reset to default (${formatSetting(f, f.default)})`}
                    iconOnly
                  />
                )}
              </div>
              <div className="ss-field__meta">
                {changed && <Badge tone="accent">Edited</Badge>}
                <span className={`ss-source ss-source--${f.source}`}>{SOURCE_LABEL[f.source]}</span>
                {f.env && <code>{f.env}</code>}
                <span>{f.scope}</span>
                {f.source === 'ui' && <span>Default {formatSetting(f, f.default)}</span>}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const STATUS_TONE = { open: 'warning', confirmed: 'good', changed: 'accent' } as const

function ReviewEditor({
  token,
  entries,
  onView,
}: {
  token: string
  entries: ReviewEntry[]
  onView: (v: SettingsView) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const toast = useToast()
  const save = async (id: string, status: string) => {
    try {
      onView(
        await request<SettingsView>('PUT', `/admin/review/${id}`, {
          token,
          body: { status, note },
        }),
      )
      setEditing(null)
      setNote('')
      toast('Review updated')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }
  const sections: [string, ReviewEntry[]][] = [
    ['Content Pack §12 review checklist', entries.filter((e) => e.kind === 'checklist')],
    ['Assumptions log (§1) and build assumptions', entries.filter((e) => e.kind === 'assumption')],
  ]
  const done = entries.filter((e) => e.status !== 'open').length
  return (
    <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
      <div>
        <h1>Content review</h1>
        <p className="secondary">
          Each item needs a confirm or a change; silence is read as confirm at gate G1. {done} of{' '}
          {entries.length} signed off.
        </p>
      </div>
      {sections.map(([title, list]) => (
        <Card key={title} title={title} flush>
          <ul className="list-reset setting-list">
            {list.map((e) => (
              <li key={e.id} className="setting-row">
                <div className="setting-row__text">
                  <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
                    <span className="code-chip code-chip--strong">{e.id}</span>
                    <span className="strong small">{e.section}</span>
                    <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
                  </div>
                  <div className="small secondary" style={{ marginTop: 4 }}>
                    {e.text}
                  </div>
                  {e.note && (
                    <div className="xs" style={{ marginTop: 4 }}>
                      <BadgeCheck size={12} aria-hidden /> {e.note}
                    </div>
                  )}
                  {editing === e.id && (
                    <div
                      className="stack"
                      style={{ '--gap': '8px', marginTop: 8 } as React.CSSProperties}
                    >
                      <Textarea
                        aria-label="Review note"
                        rows={2}
                        value={note}
                        onChange={(ev) => setNote(ev.target.value)}
                        placeholder="What was confirmed, or what changed"
                      />
                      <div className="row wrap">
                        <Button size="sm" variant="primary" onClick={() => save(e.id, 'confirmed')}>
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => save(e.id, 'changed')}
                          disabled={!note.trim()}
                        >
                          Record a change
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => save(e.id, 'open')}>
                          Reopen
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {editing !== e.id && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(e.id)
                      setNote(e.note)
                    }}
                  >
                    Review
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}

function SessionsList({ token }: { token: string }) {
  const [rows, setRows] = useState<SessionRow[] | null>(null)
  const navigate = useNavigate()
  const toast = useToast()
  useEffect(() => {
    request<SessionRow[]>('GET', '/admin/sessions', { token })
      .then(setRows)
      .catch((e) => toast(errorMessage(e), 'error'))
  }, [token, toast])
  const open = async (id: string) => {
    try {
      const r = await request<{ token: string }>('POST', `/admin/sessions/${id}/token`, { token })
      auth.setFacilitator(id, r.token)
      navigate(`/facilitator/${id}`)
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }
  const [deleting, setDeleting] = useState<string | null>(null)
  const remove = async (ids: string[]) => {
    const label =
      ids.length === 1
        ? `"${rows?.find((r) => r.id === ids[0])?.name ?? ids[0]}"`
        : `all ${ids.length} sessions`
    if (
      !window.confirm(
        `Delete ${label}? Teams, decisions and the activity log are removed permanently. This cannot be undone.`,
      )
    )
      return
    setDeleting(ids.length === 1 ? ids[0] : 'all')
    const gone: string[] = []
    try {
      for (const id of ids) {
        await request('DELETE', `/admin/sessions/${id}`, { token })
        auth.clearFacilitator(id)
        gone.push(id)
      }
      toast(ids.length === 1 ? 'Session deleted' : `${gone.length} sessions deleted`)
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setRows((prev) => (prev ? prev.filter((r) => !gone.includes(r.id)) : prev))
      setDeleting(null)
    }
  }
  return (
    <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
      <div className="row spread wrap" style={{ alignItems: 'flex-end' }}>
        <div className="grow">
          <h1>Sessions</h1>
          <p className="secondary">
            Open any session's facilitator console, or delete sessions you no longer need. Sessions
            from an older content version cannot be resumed.
          </p>
        </div>
        {rows && rows.length > 1 && (
          <Button
            variant="danger"
            icon={<Trash2 />}
            loading={deleting === 'all'}
            disabled={deleting !== null}
            onClick={() => remove(rows.map((r) => r.id))}
          >
            Delete all
          </Button>
        )}
      </div>
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty title="No sessions yet" />
      ) : (
        <Card flush>
          <table className="table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Created</th>
                <th>Progress</th>
                <th>Teams</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="strong">{r.name}</div>
                    <div className="xs muted">
                      {r.id} · content v{r.content_version}
                    </div>
                  </td>
                  <td className="small">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="small">
                    {r.stage_status === 'not_started'
                      ? 'Not started'
                      : `Stage ${r.stage_index + 1}`}{' '}
                    · Year {r.simulated_years} simulated
                  </td>
                  <td className="small">{r.teams.join(', ')}</td>
                  <td>
                    <div className="row" style={{ '--gap': '6px' } as React.CSSProperties}>
                      <Button size="sm" icon={<ExternalLink />} onClick={() => open(r.id)}>
                        Open console
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 />}
                        loading={deleting === r.id}
                        disabled={deleting !== null}
                        onClick={() => remove([r.id])}
                        aria-label={`Delete session ${r.name}`}
                        title="Delete this session"
                        className="btn--delete"
                        iconOnly
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

function SystemCard({ view }: { view: SettingsView }) {
  const s = view.system
  const rows: [string, string][] = [
    ['Environment', s.environment],
    ['App version', s.version],
    ['Content', `${s.content_pack} · v${s.content_version}`],
    ['Ports (API / web)', `${s.api_port} / ${s.web_port}`],
    ['Database', s.database],
    ['Content directory', s.content_dir],
    ['Data directory', s.data_dir],
    ['Log level', s.log_level],
    ['Allowed origins', s.cors_origins.join(', ')],
    [
      'Claude API key',
      s.ai_configured
        ? 'Configured in backend/.env'
        : 'Not set — the analyst runs in retrieval-only mode',
    ],
    ['Token signing key', s.signing_key],
    ['Admin password', s.admin_password_set ? 'Set in backend/.env' : 'Not set'],
  ]
  return (
    <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
      <div>
        <h1>System</h1>
        <p className="secondary">
          Read-only. Infrastructure and secrets are configured in <code>backend/.env</code> and need
          a restart.
        </p>
      </div>
      <Card flush>
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Setting</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <th scope="row" className="muted" style={{ width: '32%', fontWeight: 500 }}>
                  {k}
                </th>
                <td className="small">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Link to="/" className="small row" style={{ '--gap': '6px' } as React.CSSProperties}>
        <ArrowLeft size={14} aria-hidden /> Back to start
      </Link>
    </div>
  )
}
