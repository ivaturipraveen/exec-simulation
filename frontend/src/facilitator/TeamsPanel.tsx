import { FileText, PenLine, Send, Siren, Unlock, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { errorMessage, request } from '../api/client'
import { useEdition, useFacilitatorAction } from '../api/hooks'
import type { DataRoomItem, SessionView, TeamView } from '../api/types'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Field, Input, Select } from '../components/ui/Field'
import { Badge, Callout, Empty, Loading, Progress } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'
import { money } from '../lib/format'

export function TeamsPanel({ session, token }: { session: SessionView; token: string }) {
  const [teamId, setTeamId] = useState(session.teams[0]?.team_id ?? '')
  const { data, isPending } = useQuery({
    queryKey: ['session', session.id, 'team', teamId],
    queryFn: () =>
      request<{ team: TeamView }>('GET', `/sessions/${session.id}/teams/${teamId}`, { token }),
    enabled: !!teamId,
  })
  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <div className="row wrap">
        {session.teams.map((t) => (
          <Button
            key={t.team_id}
            variant={t.team_id === teamId ? 'primary' : 'secondary'}
            onClick={() => setTeamId(t.team_id)}
          >
            {t.payer_name}
          </Button>
        ))}
      </div>
      {isPending || !data ? (
        <Loading />
      ) : (
        <TeamDetail session={session} token={token} team={data.team} />
      )}
    </div>
  )
}

function TeamDetail({
  session,
  token,
  team,
}: {
  session: SessionView
  token: string
  team: TeamView
}) {
  const ws = team.workspace
  const action = useFacilitatorAction<Record<string, unknown>>(session.id, token)
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [unlock, setUnlock] = useState('opmodel')
  const [base2, setBase2] = useState('')
  const [teamName, setTeamName] = useState(team.team_name)
  const [curveball, setCurveball] = useState('')
  const [curveSev, setCurveSev] = useState('medium')
  const { data: edition } = useEdition(session.id, token)
  const eligible = (edition?.events ?? []).filter(
    (e) => !e.payer_ids.length || e.payer_ids.includes(team.payer.id),
  )
  const run = async (
    path: string,
    body: Record<string, unknown>,
    method: 'POST' | 'PUT' = 'POST',
    ok = 'Saved',
  ) => {
    try {
      await action.mutateAsync({ path, body, method })
      toast(ok)
      setNote('')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }
  const base = `/teams/${team.team_id}`
  return (
    <div className="grid grid-split">
      <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
        <Card title="Diagnosis" subtitle="Top priorities and cited evidence">
          {ws.priorities.length === 0 ? (
            <span className="muted small">No priorities saved.</span>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 18 }} className="stack">
              {ws.priorities.map((p) => (
                <li key={p.title}>
                  <div className="strong">{p.title}</div>
                  {p.rationale && <div className="small secondary">{p.rationale}</div>}
                  <div className="chip-list" style={{ marginTop: 4 }}>
                    {(p.evidence ?? []).map((e) => (
                      <Badge key={e} icon={<FileText aria-hidden />}>
                        {e}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title="Thesis evolution (CAP-003)">
          <div className="grid grid-2">
            <div>
              <div className="upper muted">Round 1</div>
              <p className="small secondary" style={{ marginTop: 4 }}>
                {ws.thesis_r1 || '—'}
              </p>
            </div>
            <div>
              <div className="upper muted">Round 2 — what changed</div>
              <p className="small secondary" style={{ marginTop: 4 }}>
                {ws.thesis_r2 || '—'}
              </p>
            </div>
          </div>
        </Card>
        <Card title="Portfolio" flush>
          {team.initiatives.length === 0 ? (
            <Empty title="Nothing funded yet" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Card</th>
                  <th>Start / live</th>
                  <th>Owner</th>
                  <th style={{ width: 120 }}>Delivered</th>
                  <th className="num">Committed</th>
                </tr>
              </thead>
              <tbody>
                {team.initiatives.map((i) => (
                  <tr key={i.investment_id}>
                    <td>
                      <span className="code-chip">{i.code}</span>{' '}
                      <span className="strong">{i.name}</span>{' '}
                      <span className="xs muted">
                        R{i.funded_round}
                        {i.scope && i.scope !== 'full' ? ` · ${i.scope}` : ''}
                        {i.status !== 'active' ? ` · ${i.status}` : ''}
                      </span>
                    </td>
                    <td className="small num">
                      {i.start_label}
                      {i.live_label && ` → ${i.live_label}`}
                    </td>
                    <td className="small">
                      {i.owner || (i.owner_required ? <Badge tone="warning">none</Badge> : '—')}
                    </td>
                    <td>
                      <Progress value={i.progress} />
                    </td>
                    <td className="num">{money(i.capital_committed, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        {ws.pitch_submitted_at && (
          <Card
            title="Board pitch"
            subtitle={
              ws.pitch_score ? `Scored ${ws.pitch_score.total}/15` : 'Submitted, not yet scored'
            }
          >
            <dl className="stack" style={{ margin: 0 }}>
              {(['results', 'causal', 'decision', 'risk', 'ask'] as const).map((k) => (
                <div key={k}>
                  <dt className="upper muted">{k}</dt>
                  <dd className="small secondary" style={{ margin: 0 }}>
                    {ws.pitch[k] || '—'}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="upper muted">Evidence</dt>
                <dd className="small" style={{ margin: 0 }}>
                  {ws.pitch.evidence.join(', ') || 'none'}
                </dd>
              </div>
            </dl>
            {ws.pitch_figures.length > 0 && (
              <Callout tone="warning" title="Unsourced figures">
                {ws.pitch_figures.join(', ')} — E6 is available for this team.
              </Callout>
            )}
          </Card>
        )}
      </div>
      <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
        <Card
          title="Facilitator overrides"
          subtitle="Every override requires an audit note (FUN-004)"
        >
          <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
            <Field label="Audit note">
              {(id) => (
                <Input
                  id={id}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why you are making this change"
                  maxLength={1000}
                />
              )}
            </Field>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="grow">
                <Field label="Adjust capital ($M, ±)">
                  {(id) => (
                    <Input
                      id={id}
                      value={amount}
                      inputMode="decimal"
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="e.g. 2 or -1.5"
                    />
                  )}
                </Field>
              </div>
              <Button
                icon={<Wallet />}
                disabled={!note.trim() || !amount || Number.isNaN(Number(amount))}
                onClick={() =>
                  run(
                    `${base}/capital`,
                    { amount_musd: Number(amount), note },
                    'POST',
                    'Capital adjusted',
                  )
                }
              >
                Apply
              </Button>
            </div>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="grow">
                <Field label="Team name">
                  {(id) => (
                    <Input
                      id={id}
                      value={teamName}
                      maxLength={80}
                      onChange={(e) => setTeamName(e.target.value)}
                    />
                  )}
                </Field>
              </div>
              <Button
                icon={<PenLine />}
                disabled={!note.trim() || !teamName.trim() || teamName.trim() === team.team_name}
                onClick={() =>
                  run(`${base}/name`, { name: teamName.trim(), note }, 'PUT', 'Team renamed')
                }
              >
                Rename
              </Button>
            </div>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="grow">
                <Field label="Re-open a submission">
                  {(id) => (
                    <Select id={id} value={unlock} onChange={(e) => setUnlock(e.target.value)}>
                      <option value="pitch">Board pitch (before capital is granted)</option>
                      <option value="opmodel">Operating model</option>
                      <option value="crisis">Crisis response</option>
                      <option value="round2">Round 2 (before Year 2)</option>
                    </Select>
                  )}
                </Field>
              </div>
              <Button
                icon={<Unlock />}
                disabled={!note.trim()}
                onClick={() => run(`${base}/unlock`, { what: unlock, note }, 'POST', 'Re-opened')}
              >
                Re-open
              </Button>
            </div>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="grow">
                <Field
                  label={`Round 2 base for this team ($M, default ${money(session.teams.find((t) => t.team_id === team.team_id)?.round2_base_musd ?? 8)})`}
                >
                  {(id) => (
                    <Input
                      id={id}
                      value={base2}
                      inputMode="decimal"
                      onChange={(e) => setBase2(e.target.value)}
                      placeholder="e.g. 6"
                    />
                  )}
                </Field>
              </div>
              <Button
                disabled={
                  !note.trim() || !base2 || Number.isNaN(Number(base2)) || session.round2_granted
                }
                onClick={() =>
                  run(
                    `${base}/round2-base`,
                    { amount_musd: Number(base2), note },
                    'PUT',
                    'Round 2 base set',
                  )
                }
              >
                Set
              </Button>
            </div>
            {session.simulated_years >= 2 && edition && (
              <div className="row wrap" style={{ alignItems: 'flex-end' }}>
                <div className="grow">
                  <Field label="Apply a curveball or crisis manually">
                    {(id) => (
                      <Select
                        id={id}
                        value={curveball || eligible[0]?.id || ''}
                        onChange={(e) => setCurveball(e.target.value)}
                      >
                        {eligible.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.code} {e.title}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>
                <Select
                  aria-label="Severity"
                  value={curveSev}
                  onChange={(e) => setCurveSev(e.target.value)}
                  style={{ width: 110 }}
                >
                  {['high', 'medium', 'low'].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
                <Button
                  icon={<Siren />}
                  disabled={!note.trim()}
                  onClick={() =>
                    run(
                      '/crisis/assign',
                      {
                        team_id: team.team_id,
                        event_id: curveball || eligible[0]?.id,
                        severity: curveSev,
                        note,
                      },
                      'POST',
                      'Crisis applied',
                    )
                  }
                >
                  Apply
                </Button>
              </div>
            )}
          </div>
        </Card>
        <EvidenceRelease session={session} token={token} team={team} />
        {ws.opmodel_score && (
          <Card
            title="Operating model"
            subtitle={`${ws.opmodel_score.total} / ${ws.opmodel_score.max}`}
          >
            <ul className="bullets small secondary">
              {ws.opmodel_findings.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Card>
        )}
        {ws.crisis_response && (
          <Card
            title="Crisis response"
            subtitle={`${ws.crisis_event_id?.toUpperCase()} ${ws.crisis_severity ?? ''} · decision: ${ws.crisis_response.decision.replace(/_/g, ' ')} · disclosure: ${ws.crisis_response.disclosure.replace(/_/g, ' ')}`}
          >
            <p className="small secondary">
              Owner: {ws.crisis_response.owner}
              {ws.crisis_score && ` · rubric ${ws.crisis_score.total}/18`}
            </p>
            {ws.crisis_response.disclosure === 'none' && (
              <Callout tone="critical">Concealment: every rubric row scores zero.</Callout>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}

function EvidenceRelease({
  session,
  token,
  team,
}: {
  session: SessionView
  token: string
  team: TeamView
}) {
  const action = useFacilitatorAction<Record<string, unknown>>(session.id, token)
  const toast = useToast()
  const { data, refetch } = useQuery({
    queryKey: ['session', session.id, 'dataroom', team.team_id],
    queryFn: () =>
      request<DataRoomItem[]>('GET', `/sessions/${session.id}/teams/${team.team_id}/dataroom`, {
        token,
      }),
  })
  const hidden = (data ?? []).filter((a) => !a.visible)
  return (
    <Card title="Evidence release" subtitle="Release later-stage documents early, e.g. as a hint">
      {hidden.length === 0 ? (
        <span className="small muted">All documents are visible to this team.</span>
      ) : (
        <ul className="list-reset stack" style={{ '--gap': '8px' } as React.CSSProperties}>
          {hidden.map((a) => (
            <li key={a.id} className="row">
              <span className="grow small">
                <span className="strong">{a.title}</span>{' '}
                <span className="muted xs">· opens at {a.release}</span>
              </span>
              <Button
                size="sm"
                icon={<Send />}
                onClick={async () => {
                  try {
                    await action.mutateAsync({
                      path: '/release',
                      body: { payer_id: team.payer.id, artifact_id: a.id },
                    })
                    toast('Released to the team')
                    refetch()
                  } catch (e) {
                    toast(errorMessage(e), 'error')
                  }
                }}
              >
                Release
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
