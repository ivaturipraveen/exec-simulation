import { AlertTriangle, CheckCircle2, Lock, Send, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import {
  useCatalog,
  useSaveRound1,
  useSaveRound2,
  useSubmitRound1,
  useSubmitRound2,
} from '../api/hooks'
import type {
  DraftItem,
  DraftPreview,
  InvestmentView,
  LedgerView,
  Round2Action,
  TeamView,
} from '../api/types'
import { CapacityPlan } from '../components/CapacityPlan'
import { InvestmentCard } from '../components/InvestmentCard'
import { cardCost } from '../lib/cost'
import { LedgerPanel } from '../components/LedgerPanel'
import { StageBanner } from '../components/StageBanner'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Dialog } from '../components/ui/Dialog'
import { Field, Input, Segmented, Select, Textarea } from '../components/ui/Field'
import { Badge, Callout, Empty, Loading, PageHeader, Progress } from '../components/ui/primitives'
import { Tabs } from '../components/ui/Tabs'
import { useToast } from '../components/ui/toastContext'
import { money } from '../lib/format'
import { useDebouncedEffect } from '../lib/useDebouncedEffect'

type Filter = 'all' | 'ai' | 'foundation' | 'people'
const FILTERS: Record<Filter, string[] | null> = {
  all: null,
  ai: ['generative', 'predictive', 'copilot', 'automation', 'agent'],
  foundation: ['data_foundation', 'governance'],
  people: ['operating_model', 'operations', 'adoption'],
}

function CatalogGrid({
  items,
  payerId,
  years,
  isSelected,
  onToggle,
}: {
  items: InvestmentView[]
  payerId: string
  years: number
  isSelected: (id: string) => boolean
  onToggle?: (id: string) => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const shown = items.filter(
    (i) => !FILTERS[filter] || FILTERS[filter]!.includes(i.capability_class),
  )
  return (
    <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
      <Segmented
        label="Filter investments"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: `All (${items.length})` },
          { value: 'ai', label: 'AI capabilities' },
          { value: 'foundation', label: 'Data & governance' },
          { value: 'people', label: 'Operations, incentives & adoption' },
        ]}
      />
      <div className="invest__grid">
        {shown.map((inv) => (
          <InvestmentCard
            key={inv.id}
            inv={inv}
            payerId={payerId}
            years={years}
            selected={isSelected(inv.id)}
            onToggle={onToggle && (() => onToggle(inv.id))}
          />
        ))}
      </div>
    </div>
  )
}

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

/** Scope, start quarter and owner controls shared by Round 1 lines and Round 2 new funding. */
function LineControls({
  inv,
  item,
  onChange,
  year,
}: {
  inv: InvestmentView
  item: { scope?: string | null; start_offset?: number; owner?: string }
  onChange: (patch: Partial<DraftItem>) => void
  year: number
}) {
  return (
    <div className="cart-line__controls">
      {inv.scopes.length > 0 && (
        <Select
          aria-label={`Scope for ${inv.code}`}
          value={item.scope ?? inv.scopes[0].id}
          onChange={(e) => onChange({ scope: e.target.value })}
        >
          {inv.scopes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      )}
      <Select
        aria-label={`Start quarter for ${inv.code}`}
        value={String(item.start_offset ?? 0)}
        onChange={(e) => onChange({ start_offset: Number(e.target.value) })}
        title="Stagger starts to stay within capacity"
      >
        {QUARTERS.map((q, i) => (
          <option key={q} value={i}>
            Start Y{year} {q}
          </option>
        ))}
      </Select>
      {inv.owner_prompt && (
        <Input
          aria-label={`${inv.owner_prompt} for ${inv.code}`}
          placeholder={`${inv.owner_prompt} (name and title)`}
          value={item.owner ?? ''}
          maxLength={120}
          onChange={(e) => onChange({ owner: e.target.value })}
          className={inv.owner_required && !(item.owner ?? '').trim() ? 'input--attention' : ''}
        />
      )}
    </div>
  )
}

function Warnings({ preview }: { preview: DraftPreview | null }) {
  if (!preview) return null
  return (
    <>
      {preview.errors.length > 0 && (
        <Callout tone="critical" title="Fix before submitting">
          {preview.errors.join(' · ')}
        </Callout>
      )}
      {preview.warnings.length > 0 && (
        <Callout tone="warning" title="Worth a second look">
          <ul className="list-reset stack" style={{ '--gap': '4px' } as React.CSSProperties}>
            {preview.warnings.map((w) => (
              <li key={w} className="small">
                {w}
              </li>
            ))}
          </ul>
        </Callout>
      )}
    </>
  )
}

export function InvestPage({ team }: { team: TeamView }) {
  const { data: catalog } = useCatalog()
  const [tab, setTab] = useState<'r1' | 'r2'>(team.flags.results_years.length >= 1 ? 'r2' : 'r1')
  if (!catalog) return <Loading />
  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <PageHeader
        eyebrow="Capital allocation"
        title={tab === 'r1' ? 'Round 1 — place your bets' : 'Round 2 — fund learning, not loyalty'}
        description={
          tab === 'r1'
            ? 'Every effect is conditional on prerequisites, adoption, capacity and your context. Write down what you believe will happen and why.'
            : `Scale, modify, pause or cancel based on evidence. Round 2 capital is the ${money(team.rules.round2_base_musd)} base plus what your board pitch earned.`
        }
      />
      <StageBanner team={team} compact />
      <Tabs
        label="Investment round"
        value={tab}
        onChange={setTab}
        tabs={[
          {
            id: 'r1',
            label: (
              <>
                Round 1{' '}
                {team.workspace.round1_submitted_at && (
                  <CheckCircle2 size={14} aria-label="submitted" />
                )}
              </>
            ),
          },
          {
            id: 'r2',
            label: (
              <>
                Round 2{' '}
                {team.workspace.round2_submitted_at && (
                  <CheckCircle2 size={14} aria-label="submitted" />
                )}
              </>
            ),
            disabled: team.flags.results_years.length < 1,
          },
        ]}
      />
      {tab === 'r1' ? (
        <Round1 team={team} catalog={catalog.investments} />
      ) : (
        <Round2 team={team} catalog={catalog.investments} />
      )}
    </div>
  )
}

function Round1({ team, catalog }: { team: TeamView; catalog: InvestmentView[] }) {
  const ws = team.workspace
  const editable = team.flags.can_edit_round1
  const [items, setItems] = useState<DraftItem[]>(ws.round1_draft)
  const [thesis, setThesis] = useState(ws.thesis_r1)
  const [preview, setPreview] = useState<DraftPreview | null>(null)
  const [confirm, setConfirm] = useState(false)
  const save = useSaveRound1()
  const submit = useSubmitRound1()
  const toast = useToast()
  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog])

  const localLedger: LedgerView = useMemo(() => {
    const committed = items.reduce((s, i) => {
      const inv = byId.get(i.investment_id)
      return s + (inv ? cardCost(inv, i.scope, 2) : 0)
    }, 0)
    return { ...team.ledger, committed, available: team.ledger.granted - committed }
  }, [items, byId, team.ledger])

  useDebouncedEffect(() => {
    if (!editable) return
    save.mutate(
      { items, thesis },
      { onSuccess: setPreview, onError: (e) => toast(errorMessage(e), 'error') },
    )
  }, [items, thesis])

  if (ws.round1_submitted_at) {
    return (
      <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
        <Callout tone="good" title="Round 1 submitted">
          Your portfolio is locked in. Leading indicators move first; results arrive after the Year
          1 simulation.
        </Callout>
        <FundedList team={team} />
        <Card title="Investment thesis">
          <p className="prose">{ws.thesis_r1}</p>
        </Card>
      </div>
    )
  }
  if (!editable) {
    return (
      <Empty title="Round 1 opens with the data room" icon={<Lock aria-hidden />}>
        Your facilitator opens investment when the session reaches Diagnose. Study the catalog
        meanwhile.
      </Empty>
    )
  }

  const toggle = (id: string) =>
    setItems((xs) =>
      xs.some((x) => x.investment_id === id)
        ? xs.filter((x) => x.investment_id !== id)
        : [...xs, { investment_id: id, owner: '', start_offset: 0 }],
    )
  const patch = (id: string, p: Partial<DraftItem>) =>
    setItems((xs) => xs.map((x) => (x.investment_id === id ? { ...x, ...p } : x)))
  const errors = preview?.errors ?? []

  return (
    <div className="invest">
      <CatalogGrid
        items={catalog}
        payerId={team.payer.id}
        years={2}
        isSelected={(id) => items.some((x) => x.investment_id === id)}
        onToggle={toggle}
      />
      <Card
        className="invest__cart"
        title="Your portfolio"
        subtitle={`${items.length} card${items.length === 1 ? '' : 's'}`}
      >
        <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
          <LedgerPanel ledger={localLedger} />
          {preview && (
            <CapacityPlan
              cap={team.rules.capacity_overrun_cap}
              utilization={preview.capacity}
              labels={QUARTERS.map((q) => `Y1 ${q}`)}
            />
          )}
          {items.length === 0 ? (
            <p className="muted small">
              Add cards from the catalog. Most strong portfolios mix technology with capacity,
              incentives and access.
            </p>
          ) : (
            <ul className="list-reset">
              {items.map((it) => {
                const inv = byId.get(it.investment_id)
                if (!inv) return null
                return (
                  <li key={it.investment_id} className="cart-line">
                    <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
                      <span className="code-chip">{inv.code}</span>
                      <span className="grow small strong">{inv.name}</span>
                      <span className="num small">{money(cardCost(inv, it.scope, 2), 2)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        icon={<X />}
                        aria-label={`Remove ${inv.name}`}
                        onClick={() => toggle(it.investment_id)}
                      />
                    </div>
                    <LineControls
                      inv={inv}
                      item={it}
                      year={1}
                      onChange={(p) => patch(it.investment_id, p)}
                    />
                  </li>
                )
              })}
            </ul>
          )}
          <Field
            label="Investment thesis"
            hint="One paragraph: what you believe will happen, and why."
          >
            {(id) => (
              <Textarea
                id={id}
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                maxLength={2000}
                placeholder="We believe… so we will fund… and expect to see… by the board pitch."
              />
            )}
          </Field>
          <Warnings preview={preview} />
          <span className="xs muted">
            {save.isPending ? 'Saving draft…' : preview ? 'Draft saved' : 'Draft not saved yet'}
          </span>
          <Button
            variant="primary"
            block
            icon={<Send />}
            disabled={
              items.length === 0 || !thesis.trim() || localLedger.available < 0 || errors.length > 0
            }
            onClick={() => setConfirm(true)}
          >
            Submit Round 1
          </Button>
        </div>
      </Card>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Submit your Round 1 portfolio?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Keep editing
            </Button>
            <Button
              variant="primary"
              loading={submit.isPending}
              onClick={async () => {
                try {
                  await save.mutateAsync({ items, thesis })
                  await submit.mutateAsync()
                  toast('Round 1 submitted')
                  setConfirm(false)
                } catch (e) {
                  toast(errorMessage(e), 'error')
                }
              }}
            >
              Submit
            </Button>
          </>
        }
      >
        <div className="stack">
          <p className="secondary">
            You are committing {money(localLedger.committed)} across {items.length} cards. In Round
            2 you can pause, cancel (recovering what is reversible) or fund new cards.
          </p>
          {(preview?.warnings.length ?? 0) > 0 && (
            <Callout tone="warning" title={`${preview!.warnings.length} warning(s) still open`}>
              Capacity overruns slow delivery and missing owners weaken or void some cards.
            </Callout>
          )}
        </div>
      </Dialog>
    </div>
  )
}

function FundedList({ team }: { team: TeamView }) {
  if (team.initiatives.length === 0) return null
  return (
    <Card title="Portfolio" flush>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Card</th>
              <th>Round</th>
              <th>Start</th>
              <th>Owner</th>
              <th>Status</th>
              <th style={{ width: 170 }}>Delivery</th>
              <th className="num">Committed</th>
            </tr>
          </thead>
          <tbody>
            {team.initiatives.map((i) => (
              <tr key={i.investment_id}>
                <td>
                  <span className="code-chip">{i.code}</span>{' '}
                  <span className="strong">{i.name}</span>
                  {i.scope && i.scope !== 'full' && <span className="muted xs"> · {i.scope}</span>}
                </td>
                <td>R{i.funded_round}</td>
                <td className="num small">{i.start_label}</td>
                <td className="small">
                  {i.owner ||
                    (i.owner_required ? (
                      <Badge tone="warning">None named</Badge>
                    ) : (
                      <span className="muted">—</span>
                    ))}
                </td>
                <td>
                  <Badge
                    tone={
                      i.status === 'active' ? 'good' : i.status === 'paused' ? 'warning' : 'neutral'
                    }
                  >
                    {i.status}
                  </Badge>
                </td>
                <td>
                  <div className="row">
                    <div className="grow">
                      <Progress value={i.progress} label={`${i.name} delivery`} />
                    </div>
                    <span className="num xs">
                      {i.live_label ? `Live ${i.live_label}` : `${Math.round(i.progress * 100)}%`}
                    </span>
                  </div>
                </td>
                <td className="num">{money(i.capital_committed, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

type Choice = '' | 'pause' | 'resume' | 'cancel'

function Round2({ team, catalog }: { team: TeamView; catalog: InvestmentView[] }) {
  const ws = team.workspace
  const editable = team.flags.can_edit_round2
  const [actions, setActions] = useState<Round2Action[]>(ws.round2_draft)
  const [thesis, setThesis] = useState(ws.thesis_r2)
  const [preview, setPreview] = useState<DraftPreview | null>(null)
  const save = useSaveRound2()
  const submit = useSubmitRound2()
  const toast = useToast()
  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog])
  const live = team.initiatives.filter((i) => i.status !== 'cancelled')
  const liveIds = new Set(live.map((i) => i.investment_id))
  const funding = actions.filter((a) => a.action === 'fund')
  const fundingIds = new Set(funding.map((a) => a.investment_id))

  useDebouncedEffect(() => {
    if (!editable) return
    save.mutate(
      { actions, thesis },
      { onSuccess: setPreview, onError: (e) => toast(errorMessage(e), 'error') },
    )
  }, [actions, thesis])

  if (ws.round2_submitted_at) {
    return (
      <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
        <Callout tone="good" title="Round 2 submitted">
          Your revised portfolio is applied. Year 2 results follow the simulation.
        </Callout>
        <FundedList team={team} />
        <Card title="What we learned and changed">
          <p className="prose">{ws.thesis_r2}</p>
        </Card>
      </div>
    )
  }
  if (!editable)
    return (
      <Empty title="Round 2 is not open">
        It opens once your facilitator releases the Year 1 results.
      </Empty>
    )

  const choiceFor = (id: string): Choice =>
    (actions.find((x) => x.investment_id === id && ['pause', 'resume', 'cancel'].includes(x.action))
      ?.action as Choice) ?? ''
  const setChoice = (id: string, c: Choice) =>
    setActions((xs) => {
      const rest = xs.filter(
        (x) => !(x.investment_id === id && ['pause', 'resume', 'cancel'].includes(x.action)),
      )
      return c ? [...rest, { action: c, investment_id: id, owner: '', start_offset: 0 }] : rest
    })
  const ownerFor = (id: string) =>
    actions.find((x) => x.investment_id === id && x.action === 'owner')?.owner
  const setOwner = (id: string, owner: string) =>
    setActions((xs) => [
      ...xs.filter((x) => !(x.investment_id === id && x.action === 'owner')),
      { action: 'owner', investment_id: id, owner, start_offset: 0 },
    ])
  const toggleFund = (id: string) =>
    setActions((xs) =>
      fundingIds.has(id)
        ? xs.filter((x) => !(x.action === 'fund' && x.investment_id === id))
        : [...xs, { action: 'fund', investment_id: id, owner: '', start_offset: 0 }],
    )
  const patchFund = (id: string, p: Partial<DraftItem>) =>
    setActions((xs) =>
      xs.map((x) => (x.action === 'fund' && x.investment_id === id ? { ...x, ...p } : x)),
    )

  const ledger = preview?.ledger ?? team.ledger
  const errors = preview?.errors ?? []

  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      {!team.round2_granted && (
        <Callout tone="accent" title="Round 2 capital not yet granted">
          Plan now; capital shown is an estimate until the facilitator scores the board pitches and
          grants Round 2.{' '}
          {!ws.pitch_submitted_at && <Link to="/team/pitch">Prepare your board pitch →</Link>}
        </Callout>
      )}
      <div className="invest">
        <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
          <Card title="Existing cards" subtitle="Continue, pause, resume or cancel each bet" flush>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Card</th>
                    <th style={{ width: 150 }}>Delivery</th>
                    <th>Owner</th>
                    <th style={{ width: 200 }}>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {live.map((i) => (
                    <tr key={i.investment_id}>
                      <td>
                        <div>
                          <span className="code-chip">{i.code}</span>{' '}
                          <span className="strong">{i.name}</span>
                        </div>
                        <div className="xs muted">
                          Recoverable if cancelled: {money(i.recoverable, 2)}
                        </div>
                      </td>
                      <td>
                        <div className="row">
                          <div className="grow">
                            <Progress value={i.progress} />
                          </div>
                          <span className="num xs">
                            {i.live_label ? 'Live' : `${Math.round(i.progress * 100)}%`}
                          </span>
                        </div>
                      </td>
                      <td>
                        {i.owner_required && !i.owner ? (
                          <Input
                            aria-label={`Name owner for ${i.code}`}
                            placeholder="Name an owner"
                            value={ownerFor(i.investment_id) ?? ''}
                            className="input--attention"
                            onChange={(e) => setOwner(i.investment_id, e.target.value)}
                          />
                        ) : (
                          <span className="small">{i.owner || '—'}</span>
                        )}
                      </td>
                      <td>
                        <Select
                          aria-label={`Decision for ${i.name}`}
                          value={choiceFor(i.investment_id)}
                          onChange={(e) => setChoice(i.investment_id, e.target.value as Choice)}
                        >
                          <option value="">Continue as is</option>
                          {i.status === 'active' && <option value="pause">Pause</option>}
                          {i.status === 'paused' && <option value="resume">Resume</option>}
                          <option value="cancel">Cancel and recover capital</option>
                        </Select>
                      </td>
                    </tr>
                  ))}
                  {live.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">
                        No live cards.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          <div>
            <h2 style={{ marginBottom: 12 }}>Fund new cards</h2>
            <CatalogGrid
              items={catalog.filter((c) => !liveIds.has(c.id))}
              payerId={team.payer.id}
              years={1}
              isSelected={(id) => fundingIds.has(id)}
              onToggle={toggleFund}
            />
          </div>
        </div>
        <Card
          className="invest__cart"
          title="Round 2 plan"
          subtitle={`${actions.length} change${actions.length === 1 ? '' : 's'}`}
        >
          <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
            <LedgerPanel ledger={ledger} estimate={preview?.capital_is_estimate} />
            {preview && (
              <CapacityPlan
                cap={team.rules.capacity_overrun_cap}
                utilization={preview.capacity}
                labels={QUARTERS.map((q) => `Y2 ${q}`)}
              />
            )}
            {funding.length > 0 && (
              <ul className="list-reset">
                {funding.map((a) => {
                  const inv = byId.get(a.investment_id)
                  if (!inv) return null
                  return (
                    <li key={a.investment_id} className="cart-line">
                      <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
                        <span className="code-chip">{inv.code}</span>
                        <span className="grow small strong">{inv.name}</span>
                        <span className="num small">{money(cardCost(inv, a.scope, 1), 2)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          icon={<X />}
                          aria-label={`Remove ${inv.name}`}
                          onClick={() => toggleFund(a.investment_id)}
                        />
                      </div>
                      <LineControls
                        inv={inv}
                        item={a}
                        year={2}
                        onChange={(p) => patchFund(a.investment_id, p)}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
            <Field
              label="What did you learn, and what are you changing?"
              hint="Required — your updated causal thesis."
            >
              {(id) => (
                <Textarea
                  id={id}
                  value={thesis}
                  onChange={(e) => setThesis(e.target.value)}
                  maxLength={2000}
                />
              )}
            </Field>
            <Warnings preview={preview} />
            {ledger.available < 0 && (
              <Callout tone="critical" title="Over budget">
                <AlertTriangle size={14} aria-hidden /> The ledger blocks overspend. Remove or
                cancel something.
              </Callout>
            )}
            <span className="xs muted">
              {save.isPending ? 'Saving draft…' : preview ? 'Draft saved' : ''}
            </span>
            <Button
              variant="primary"
              block
              icon={<Send />}
              loading={submit.isPending}
              disabled={
                !team.round2_granted || !thesis.trim() || errors.length > 0 || ledger.available < 0
              }
              onClick={async () => {
                try {
                  await save.mutateAsync({ actions, thesis })
                  await submit.mutateAsync()
                  toast('Round 2 submitted')
                } catch (e) {
                  toast(errorMessage(e), 'error')
                }
              }}
            >
              Submit Round 2
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
