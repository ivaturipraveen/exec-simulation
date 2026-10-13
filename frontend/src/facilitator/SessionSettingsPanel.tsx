import { Lock, PencilLine, Save, Settings2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { useFacilitatorAction, useSessionPart } from '../api/hooks'
import type { SessionSettingView, SessionView } from '../api/types'
import { SettingControl } from '../components/SettingControl'
import { formatSetting } from '../lib/settings'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Badge, Callout, Loading } from '../components/ui/primitives'
import { Tabs } from '../components/ui/Tabs'
import { useToast } from '../components/ui/toastContext'

/** One line per group: what these settings change during the workshop. */
const GROUP_INTRO: Record<string, string> = {
  'Session defaults': 'Capital, Stars target and the optional translation stage for this session.',
  Facilitation:
    'Nudges, stall flags and the board-pitch timing the console uses while you run the room.',
  'Model parameters':
    'How the simulation turns investments into results. Changes affect the next simulated year.',
  Scorecard: 'How the five scorecard dimensions are weighted and penalised in the final results.',
}

/** This session's configuration snapshot. Changes need an audit note; model and scoring
 * parameters lock once Year 1 has been simulated so results stay consistent. */
export function SessionSettingsPanel({ session, token }: { session: SessionView; token: string }) {
  const { data, refetch } = useSessionPart<SessionSettingView[]>(session.id, token, 'settings')
  const action = useFacilitatorAction<Record<string, unknown>>(session.id, token)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [note, setNote] = useState('')
  const [active, setActive] = useState<string>('')
  const toast = useToast()
  const groups = useMemo(() => {
    const by = new Map<string, SessionSettingView[]>()
    for (const f of data ?? []) by.set(f.group, [...(by.get(f.group) ?? []), f])
    return [...by.entries()]
  }, [data])
  if (!data) return <Loading />
  const pending = Object.keys(draft).length
  const current = groups.some(([g]) => g === active) ? active : (groups[0]?.[0] ?? '')
  const groupFields = groups.find(([g]) => g === current)?.[1]
  const lockedCount = groupFields?.filter((f) => f.locked).length ?? 0
  // The five dimension weights must total 100% wherever they are edited; check them across all groups.
  const weightKeys = data.filter((f) => f.key.startsWith('score_weights.'))
  const showWeights = (groupFields ?? []).some((f) => f.key.startsWith('score_weights.'))
  const weightSum = weightKeys.reduce(
    (n, f) => n + Number(f.key in draft ? draft[f.key] : f.value),
    0,
  )
  const weightsOk = Math.abs(weightSum - 1) < 0.001
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
      <Tabs
        label="Setting groups"
        value={current}
        onChange={setActive}
        tabs={groups.map(([group, fields]) => {
          const edits = fields.filter((f) => f.key in draft).length
          const locked = fields.every((f) => f.locked)
          return {
            id: group,
            label: (
              <>
                {group}
                <span className="ss-tab__count">{fields.length}</span>
                {edits > 0 ? (
                  <PencilLine size={13} aria-label={`${edits} edited`} />
                ) : (
                  locked && <Lock size={12} aria-label="locked" />
                )}
              </>
            ),
          }
        })}
      />
      {groupFields && (
        <section className="card ss-panel" aria-label={current}>
          <header className="ss-panel__head">
            <div>
              <h2 className="ss-panel__title">{current}</h2>
              {GROUP_INTRO[current] && <p className="ss-panel__intro">{GROUP_INTRO[current]}</p>}
            </div>
            <span className="ss-panel__count">
              {groupFields.length} setting{groupFields.length === 1 ? '' : 's'}
            </span>
          </header>
          {lockedCount > 0 && (
            <div className="ss-panel__lock">
              <Lock size={14} aria-hidden />
              {lockedCount === groupFields.length
                ? 'Read only: these parameters locked when Year 1 was simulated, so results stay comparable.'
                : `${lockedCount} of these locked when Year 1 was simulated; the rest can still change.`}
            </div>
          )}
          {showWeights && (
            <div className={`ss-panel__check ${weightsOk ? 'is-ok' : 'is-bad'}`}>
              Dimension weights total {Math.round(weightSum * 1000) / 10}%
              {weightsOk ? ' · balanced' : ' · adjust to 100% before saving'}
            </div>
          )}
          <ul className="list-reset ss-grid">
            {groupFields.map((f) => {
              const changed = f.key in draft
              const value = changed ? draft[f.key] : f.value
              const differs = JSON.stringify(f.value) !== JSON.stringify(f.default)
              return (
                <li
                  key={f.key}
                  className={`ss-field ${changed ? 'is-changed' : ''} ${f.locked ? 'is-locked' : ''} ${f.kind === 'bool' ? 'is-bool' : ''}`}
                >
                  <div className="ss-field__text">
                    <label className="ss-field__label" htmlFor={`setting-${f.key}`}>
                      {f.label}
                      {f.locked && lockedCount < groupFields.length && (
                        <Lock size={11} aria-label="locked" />
                      )}
                    </label>
                    {f.help && <p className="ss-field__help">{f.help}</p>}
                    {(changed || differs) && (
                      <div className="ss-field__meta">
                        {changed && <Badge tone="accent">Edited</Badge>}
                        {differs && <span>Global default {formatSetting(f, f.default)}</span>}
                      </div>
                    )}
                  </div>
                  <div className="ss-field__control">
                    <SettingControl
                      spec={f}
                      value={value}
                      disabled={f.locked}
                      onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                    />
                    {f.kind === 'bool' && (
                      <span className="setting-tile__state">{value ? 'On' : 'Off'}</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {pending > 0 && (
        <div className="ss-savebar" role="status">
          <div className="ss-savebar__count">
            <Settings2 size={16} aria-hidden />
            <span>
              <strong>{pending}</strong> unsaved change{pending === 1 ? '' : 's'}
            </span>
          </div>
          <Input
            aria-label="Audit note"
            className="ss-savebar__note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Audit note (required): why this session differs"
          />
          <div className="ss-savebar__actions">
            <Button variant="ghost" onClick={() => setDraft({})}>
              Discard
            </Button>
            <Button
              variant="primary"
              icon={<Save />}
              loading={action.isPending}
              disabled={!note.trim() || (weightKeys.length > 0 && !weightsOk)}
              onClick={save}
            >
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
