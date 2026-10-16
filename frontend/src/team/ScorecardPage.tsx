import {
  ChevronDown,
  ShieldAlert,
  Star,
  Target,
  TrendingUp,
  Trophy,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import { useScorecard } from '../api/hooks'
import type { TeamView } from '../api/types'
import { BarList } from '../components/charts'
import { Card } from '../components/ui/Card'
import { Empty, Loading, PageHeader, StarRating, Stat } from '../components/ui/primitives'

/** "E3 Clinically sound… (high severity): Adoption 7%…" as one compact line; the detail opens on demand. */
function FlagNote({ flag }: { flag: string }) {
  const [open, setOpen] = useState(false)
  const crisis = flag.startsWith('E')
  const m = flag.match(/^(\S+)\s+(.*?)(?:\s+\((\w+) severity\))?:\s*([\s\S]*)$/)
  const [code, headline, severity, detail] = m ? [m[1], m[2], m[3], m[4]] : ['', flag, '', '']
  return (
    <aside className={`flag-note ${crisis ? 'flag-note--crisis' : 'flag-note--guard'}`} role="note">
      <div className="flag-note__row">
        <span className="flag-note__icon" aria-hidden>
          {crisis ? <TriangleAlert size={14} /> : <ShieldAlert size={14} />}
        </span>
        <span className="flag-note__kind">
          {crisis ? 'Crisis' : 'Guardrail'}
          {code && ` ${code}`}
        </span>
        <span className="flag-note__headline">{headline}</span>
        {severity && <span className="flag-note__sev">{severity}</span>}
        {detail && (
          <button
            type="button"
            className="flag-note__more"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Less' : 'Details'}
            <ChevronDown size={14} aria-hidden />
          </button>
        )}
      </div>
      {open && detail && <p className="flag-note__detail">{detail}</p>}
    </aside>
  )
}

export function ScorecardPage({ team }: { team: TeamView }) {
  const available = team.flags.scorecard_available
  const { data: card, isPending } = useScorecard(available)
  if (!available)
    return (
      <Empty title="Scorecard not released yet" icon={<Trophy aria-hidden />}>
        It is revealed at the Final results stage.
      </Empty>
    )
  if (isPending || !card) return <Loading />
  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <PageHeader
        title="Who created sustainable value?"
        description="Five dimensions, normalized by payer: lift divided by headroom, benefit divided by the 4-Star bonus value. Read the profile and the causal story, never only the total."
      />
      <div className="grid grid-4">
        <Stat
          icon={<Trophy />}
          label="Total score"
          value={
            <>
              {card.total.toFixed(0)} <span className="muted small">/ 100</span>
            </>
          }
          meta={
            card.total < card.uncapped_total ? (
              <span className="delta-down">Capped from {card.uncapped_total.toFixed(0)}</span>
            ) : (
              <span>Weighted across five dimensions</span>
            )
          }
        />
        <Stat
          icon={<Star />}
          label="Starting Stars"
          value={card.stars_start.toFixed(1)}
          meta={<StarRating value={card.stars_start} />}
        />
        <Stat
          icon={<TrendingUp />}
          label={`Year ${card.year} rating → projected`}
          value={`${card.stars_year.toFixed(1)} → ${card.stars_projected.toFixed(1)}`}
          meta={<StarRating value={card.stars_projected} />}
        />
        <Stat
          icon={<Target />}
          label="Target"
          value={card.stars_target.toFixed(1)}
          meta={
            <span>
              {card.stars_projected >= card.stars_target ? 'On the projected path' : 'Not yet'} ·
              equity {card.equity_modifier > 0 ? '+' : ''}
              {card.equity_modifier.toFixed(1)}
            </span>
          }
        />
      </div>
      {card.flags.map((f) => (
        <FlagNote key={f} flag={f} />
      ))}
      <Card title="Dimension profile" subtitle="Each scored 0–100; weights 30 / 20 / 20 / 15 / 15">
        <BarList
          data={card.dimensions.map((d) => ({
            label: `${d.label} (${Math.round(d.weight * 100)}%)`,
            value: d.score,
          }))}
          format={(v) => v.toFixed(0)}
        />
      </Card>
      <div className="grid grid-2">
        {card.dimensions.map((d) => (
          <Card
            key={d.id}
            title={d.label}
            subtitle={`${d.score.toFixed(0)} / 100 · weight ${Math.round(d.weight * 100)}%`}
          >
            <ul style={{ margin: 0, paddingLeft: 18 }} className="secondary small">
              {d.drivers.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}
