import { Check, ChevronDown, Clock, Gauge, Plus, UserCheck } from 'lucide-react'
import { useState } from 'react'
import type { InvestmentView } from '../api/types'
import { cardCost } from '../lib/cost'
import { LEVEL_TONE, money } from '../lib/format'
import { Button } from './ui/Button'
import { Badge } from './ui/primitives'

export function InvestmentCard({
  inv,
  payerId,
  selected,
  onToggle,
  years = 2,
}: {
  inv: InvestmentView
  payerId: string
  selected: boolean
  onToggle?: () => void
  years?: number
}) {
  const [open, setOpen] = useState(false)
  const fit = inv.payer_fit[payerId]
  return (
    <article className={`card inv ${selected ? 'card--selected' : ''}`}>
      <div className="inv__head">
        <span className="row" style={{ '--gap': '6px' } as React.CSSProperties}>
          <span className="code-chip code-chip--strong">{inv.code}</span>
          <Badge tone="accent">{inv.class_label}</Badge>
        </span>
        <span className="num strong" title={inv.cost_text}>
          {money(cardCost(inv, null, years), 2)}
          {inv.cost_basis === 'per_year' && <span className="xs muted"> ({years} yr)</span>}
        </span>
      </div>
      <h3 className="inv__title">{inv.name}</h3>
      <p className="inv__summary">{inv.summary}</p>
      <div className="inv__meta">
        <span title="Implementation time">
          <Clock aria-hidden /> {inv.duration_quarters} qtr
        </span>
        <span title="Capacity points per quarter while building">
          <Gauge aria-hidden /> {inv.capacity_points} pts/qtr
        </span>
        <span title="Run cost">{inv.opex_text}</span>
        {inv.owner_prompt && (
          <span title="Needs a named owner">
            <UserCheck aria-hidden /> {inv.owner_prompt}
          </span>
        )}
      </div>
      <p className="inv__effect-text">{inv.effect_text}</p>
      {fit && (
        <div className={`fit fit--${fit.level}`}>
          <Badge tone={LEVEL_TONE[fit.level]} outline>
            Fit here: {fit.level}
          </Badge>
          <span className="xs secondary">{fit.note}</span>
        </div>
      )}
      <button
        type="button"
        className="inv__more"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined }} />{' '}
        Prerequisites, risks and decay
      </button>
      {open && (
        <dl className="inv__details">
          <dt>Prerequisites</dt>
          <dd>{inv.prerequisites_text}</dd>
          <dt>Decay</dt>
          <dd>{inv.decay_text}</dd>
          <dt>Risk exposure</dt>
          <dd>{inv.risk_text}</dd>
          <dt>Synergies</dt>
          <dd>{inv.synergies.join(', ') || 'None'}</dd>
          <dt>Conflicts</dt>
          <dd>{inv.conflicts_text}</dd>
          <dt>Reversible</dt>
          <dd>{inv.reversible_text}</dd>
          {inv.scopes.length > 0 && (
            <>
              <dt>Scope options</dt>
              <dd>{inv.scopes.map((s) => `${s.label} ${money(s.cost_musd)}`).join(' · ')}</dd>
            </>
          )}
        </dl>
      )}
      <div className="inv__foot">
        {inv.measures.length > 0 ? (
          <span className="xs muted">Moves {inv.measures.join(', ')}</span>
        ) : (
          <span className="xs muted">Enabler: no direct measure effect</span>
        )}
        <span className="grow" />
        {onToggle && (
          <Button
            size="sm"
            variant={selected ? 'primary' : 'secondary'}
            icon={selected ? <Check /> : <Plus />}
            onClick={onToggle}
            aria-label={`${selected ? 'Remove' : 'Add'} ${inv.code} ${inv.name}`}
          >
            {selected ? 'Added' : 'Add'}
          </Button>
        )}
      </div>
    </article>
  )
}
