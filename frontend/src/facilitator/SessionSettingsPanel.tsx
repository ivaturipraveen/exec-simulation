import { Lock, Save, Settings2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useFacilitatorAction, useSessionPart } from '../api/hooks'
import type { SessionSettingView, SessionView } from '../api/types'
import { SettingControl } from '../components/SettingControl'
import { formatSetting } from '../lib/settings'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Field, Input } from '../components/ui/Field'
import { Badge, Callout, Loading } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'

/** This session's configuration snapshot. Changes need an audit note; model and scoring
 * parameters lock once Year 1 has been simulated so results stay consistent. */
export function SessionSettingsPanel({ session, token }: { session: SessionView; token: string }) {
  const { data, refetch } = useSessionPart<SessionSettingView[]>(session.id, token, 'settings')
  const action = useFacilitatorAction<Record<string, unknown>>(session.id, token)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [note, setNote] = useState('')
  const toast = useToast()
  const groups = useMemo(() => {
    const by = new Map<string, SessionSettingView[]>()
    for (const f of data ?? []) by.set(f.group, [...(by.get(f.group) ?? []), f])
    return [...by.entries()]
  }, [data])
  if (!data) return <Loading />
  const pending = Object.keys(draft).length
  const save = async () => {
    try {
      await action.mutateAsync({ path: '/settings', method: 'PUT', body: { values: draft, note } })
      setDraft({})
      setNote('')
      await refetch()
      toast('Session settings saved')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }
  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <Callout tone="accent" title="Settings for this session only">
        This session keeps the configuration it was created with. Changes here need an audit note
        and appear in the activity log. Model and scorecard parameters lock once Year 1 is
        simulated. Defaults for new sessions live in <Link to="/settings">Settings</Link>.
      </Callout>
      {groups.map(([group, fields]) => (
        <Card key={group} title={group} flush>
          <ul className="list-reset setting-list">
            {fields.map((f) => {
              const changed = f.key in draft
              const value = changed ? draft[f.key] : f.value
              const differs = JSON.stringify(f.value) !== JSON.stringify(f.default)
              return (
                <li key={f.key} className={`setting-row ${changed ? 'is-changed' : ''}`}>
                  <div className="setting-row__text">
                    <label className="strong small" htmlFor={`setting-${f.key}`}>
                      {f.label}
                    </label>
                    {f.help && <div className="xs secondary">{f.help}</div>}
                    <div
                      className="row wrap xs muted"
                      style={{ '--gap': '8px', marginTop: 4 } as React.CSSProperties}
                    >
                      {f.locked && (
                        <Badge icon={<Lock size={11} aria-hidden />} outline>
                          Locked after Year 1
                        </Badge>
                      )}
                      {differs && <span>Global default {formatSetting(f, f.default)}</span>}
                    </div>
                  </div>
                  <div className="setting-row__control">
                    <SettingControl
                      spec={f}
                      value={value}
                      disabled={f.locked}
                      onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      ))}
      {pending > 0 && (
        <div className="settings__savebar settings__savebar--inline" role="status">
          <Settings2 size={16} aria-hidden />
          <span>
            <strong>{pending}</strong> change{pending === 1 ? '' : 's'}
          </span>
          <Field label="Audit note">
            {(id) => (
              <Input
                id={id}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why this session differs"
                style={{ minWidth: 280 }}
              />
            )}
          </Field>
          <Button variant="ghost" onClick={() => setDraft({})}>
            Discard
          </Button>
          <Button
            variant="primary"
            icon={<Save />}
            loading={action.isPending}
            disabled={!note.trim()}
            onClick={save}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  )
}
