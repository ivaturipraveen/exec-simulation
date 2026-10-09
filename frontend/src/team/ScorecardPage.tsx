import { Flag, Trophy } from 'lucide-react'
import { useScorecard } from '../api/hooks'
import type { TeamView } from '../api/types'
import { BarList } from '../components/charts'
import { Card } from '../components/ui/Card'
import { Callout, Empty, Loading, PageHeader, StarRating, Stat } from '../components/ui/primitives'

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
        eyebrow="Executive scorecard"
        title="Who created sustainable value?"
        description="Five dimensions, normalized by payer: lift divided by headroom, benefit divided by the 4-Star bonus value. Read the profile and the causal story, never only the total."
      />
      <div className="grid grid-4">
        <div className="card stat">
          <div className="stat__label">Total score</div>
          <div className="score-hero">
            <span className="score-hero__value">{card.total.toFixed(0)}</span>
            <span className="muted">/ 100</span>
          </div>
          {card.total < card.uncapped_total && (
            <div className="stat__meta delta-down">
              Capped from {card.uncapped_total.toFixed(0)}
            </div>
          )}
        </div>
        <Stat
          label="Starting Stars"
          value={card.stars_start.toFixed(1)}
          meta={<StarRating value={card.stars_start} />}
        />
        <Stat
          label={`Year ${card.year} rating → projected`}
          value={`${card.stars_year.toFixed(1)} → ${card.stars_projected.toFixed(1)}`}
          meta={<StarRating value={card.stars_projected} />}
        />
        <Stat
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
        <Callout
          key={f}
          tone={f.startsWith('E') ? 'warning' : 'critical'}
          title={f.startsWith('E') ? 'Crisis effect' : 'Guardrail applied'}
        >
          <span className="row">
            <Flag size={14} aria-hidden /> {f}
          </span>
        </Callout>
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
