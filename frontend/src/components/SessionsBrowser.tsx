import { useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Inbox, Search, Smartphone, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage, request } from '../api/client'
import { useCatalog } from '../api/hooks'
import { sessionsKey, useSessions } from '../api/sessions'
import type { SessionRow } from '../api/types'
import { auth, signIn } from '../lib/storage'
import { Button } from './ui/Button'
import { Loading } from './ui/primitives'
import { useConfirm, useToast } from './ui/toastContext'

const STATUS: Record<string, { label: string; tone: string }> = {
  not_started: { label: 'Not started', tone: 'idle' },
  running: { label: 'Live', tone: 'live' },
  paused: { label: 'Paused', tone: 'paused' },
  completed: { label: 'Completed', tone: 'done' },
}

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`
  return new Date(iso).toLocaleDateString()
}

/** Sessions list for the facilitator: open any session's console or delete it. */
export function SessionsBrowser() {
  const { data: rows, isPending, error } = useSessions()
  const { data: catalog } = useCatalog()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const stages = catalog?.stages.length ?? 0
  const onDevice = new Set(auth.knownSessions())

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows ?? []
    return (rows ?? []).filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.id.includes(q) ||
        r.teams.some((t) => t.toLowerCase().includes(q)),
    )
  }, [rows, query])

  async function open(r: SessionRow) {
    setBusy(r.id)
    try {
      const { token } = await request<{ token: string }>('POST', `/admin/sessions/${r.id}/token`, {
        token: signIn.get(),
      })
      auth.setFacilitator(r.id, token)
      navigate(`/facilitator/${r.id}`)
    } catch (e) {
      toast(errorMessage(e), 'error')
      setBusy(null)
    }
  }

  async function remove(r: SessionRow) {
    const teams = r.teams.length
    const ok = await confirm({
      title: `Delete "${r.name}"?`,
      message: `${teams ? `Its ${teams} team${teams === 1 ? '' : 's'} (${r.teams.join(', ')}), their decisions and the activity log` : 'The session and its activity log'} are removed permanently. This cannot be undone.`,
      tone: 'danger',
      confirmLabel: 'Delete session',
    })
    if (!ok) return
    setBusy(r.id)
    try {
      await request('DELETE', `/admin/sessions/${r.id}`, { token: signIn.get() })
      auth.clearFacilitator(r.id)
      queryClient.setQueryData<SessionRow[]>(sessionsKey, (prev) =>
        prev?.filter((x) => x.id !== r.id),
      )
      toast(`Deleted "${r.name}"`, 'success')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  if (isPending) return <Loading label="Loading sessions…" />
  if (error) return <p className="secondary small">{errorMessage(error)}</p>
  if (!rows?.length)
    return (
      <div className="sessions__empty">
        <Inbox aria-hidden />
        <div className="strong">No sessions yet</div>
        <div className="secondary small">Create one from the New session tab.</div>
      </div>
    )

  return (
    <div className="sessions">
      {rows.length > 3 && (
        <label className="sessions__search">
          <Search aria-hidden />
          <input
            type="search"
            placeholder="Search by name, team or ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search sessions"
          />
        </label>
      )}
      <ul className="list-reset sessions__list" aria-label="Sessions">
        {shown.map((r) => {
          const status = STATUS[r.stage_status] ?? STATUS.not_started
          const old = !!catalog && r.content_version !== catalog.content_version
          const done = r.stage_status === 'completed'
          const step = r.stage_status === 'not_started' ? 0 : r.stage_index + 1
          const pct = done ? 100 : stages ? Math.round((step / stages) * 100) : 0
          return (
            <li key={r.id} className={`session-row session-row--${status.tone}`}>
              <div className="session-row__main">
                <div className="session-row__title">
                  <span className="session-row__name">{r.name}</span>
                  <span className={`session-status session-status--${status.tone}`}>
                    {status.label}
                  </span>
                </div>
                <div className="session-row__meta">
                  <span>{ago(r.created_at)}</span>
                  <span aria-hidden>·</span>
                  <code>{r.id}</code>
                  {onDevice.has(r.id) && (
                    <span className="session-row__tag" title="Opened on this device">
                      <Smartphone aria-hidden /> This device
                    </span>
                  )}
                  {old && (
                    <span className="session-row__tag is-warn" title="Created with older content">
                      v{r.content_version}
                    </span>
                  )}
                </div>
                <div
                  className="session-row__progress"
                  role="img"
                  aria-label={`${status.label}${step ? `, stage ${step} of ${stages}` : ''}`}
                >
                  <span className="session-row__bar">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <span className="session-row__step">
                    {done
                      ? `Year ${r.simulated_years} done`
                      : step
                        ? `Stage ${step}${stages ? `/${stages}` : ''}`
                        : 'Lobby'}
                  </span>
                </div>
                {r.teams.length > 0 && (
                  <div className="session-row__teams">
                    <Users aria-hidden />
                    {r.teams.join(' · ')}
                  </div>
                )}
              </div>
              <div className="session-row__actions">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<ArrowUpRight />}
                  loading={busy === r.id}
                  disabled={busy !== null || old}
                  title={old ? 'Sessions from an older content version cannot be resumed' : ''}
                  onClick={() => open(r)}
                >
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  icon={<Trash2 />}
                  className="session-row__delete"
                  aria-label={`Delete ${r.name}`}
                  title="Delete session"
                  disabled={busy !== null}
                  onClick={() => remove(r)}
                />
              </div>
            </li>
          )
        })}
        {shown.length === 0 && <li className="secondary small">No sessions match “{query}”.</li>}
      </ul>
    </div>
  )
}
