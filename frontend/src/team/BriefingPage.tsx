import { ArrowRight, Building2, Gauge, Scale, Sparkles, Users, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../api/hooks'
import type { TeamView } from '../api/types'
import { StageBanner } from '../components/StageBanner'
import { Card } from '../components/ui/Card'
import { Badge, Callout, StarRating, Stat } from '../components/ui/primitives'
import { kpiValue, measureValue, money, pct } from '../lib/format'

export function BriefingPage({ team }: { team: TeamView }) {
  const { data: catalog } = useCatalog()
  const p = team.payer
  const measures = new Map(catalog?.measures.map((m) => [m.id, m]) ?? [])
  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <section className="hero">
        <div className="hero__body">
          <span className="hero__eyebrow">{p.archetype}</span>
          <h1 className="hero__title">{p.name}</h1>
          <p className="hero__tagline">{p.tagline}</p>
          <div className="row wrap" style={{ '--gap': '8px' } as React.CSSProperties}>
            <Badge tone="accent" icon={<Sparkles size={12} aria-hidden />}>
              {p.starting_stars_text}
            </Badge>
            <Badge outline>Target {p.target_stars.toFixed(1)} Stars</Badge>
            <Badge outline>Data readiness {p.data_readiness} of 5</Badge>
          </div>
        </div>
        <div className="hero__stars" aria-hidden>
          <StarRating value={p.starting_stars} />
        </div>
      </section>

      {team.clock.status === 'not_started' ? (
        <Callout tone="accent" title="The session has not started yet">
          Read your briefing and board mandate. Your facilitator will start the clock shortly.
        </Callout>
      ) : (
        <StageBanner team={team} />
      )}

      <div className="grid grid-4">
        <Stat
          label="Members"
          icon={<Users size={14} aria-hidden />}
          value={p.members.toLocaleString()}
          meta={`Dual-eligible ${pct(p.dual_share)}`}
        />
        <Stat
          label="Round 1 capital"
          icon={<Wallet size={14} aria-hidden />}
          value={money(p.capital_round1_musd, 1)}
          meta={`Round 2: ${money(p.round2_base_musd, 1)} base + up to ${money(team.rules.round2_max_earned_musd, 1)} earned at the board pitch`}
        />
        <Stat
          label="Capacity per quarter"
          icon={<Gauge size={14} aria-hidden />}
          value={`${p.capacity_per_quarter} pts`}
          meta="Each card consumes points while it is being built"
        />
        <Stat
          label="4-Star bonus value"
          icon={<Scale size={14} aria-hidden />}
          value={money(p.bonus_value_musd, 1)}
          meta={`Per year, illustrative ($${team.rules.bonus_pmpy_usd.toLocaleString()} per member)`}
        />
      </div>

      <div className="grid grid-split">
        <Card title="Briefing">
          <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
            <p className="prose">{p.briefing}</p>
            <Callout tone="accent" title="Board mandate">
              {p.board_mandate}
            </Callout>
            <p className="prose small">{p.population}</p>
          </div>
        </Card>
        <Card title="Profile" flush>
          <table className="table table--compact">
            <tbody>
              {p.profile.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className="muted" style={{ width: '38%', fontWeight: 500 }}>
                    {r.label}
                  </th>
                  <td>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Visible advantages">
          <ul className="list-reset stack" style={{ '--gap': '8px' } as React.CSSProperties}>
            {p.advantages.map((a) => (
              <li key={a} className="bullet bullet--good">
                {a}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Visible constraints">
          <ul className="list-reset stack" style={{ '--gap': '8px' } as React.CSSProperties}>
            {p.constraints.map((a) => (
              <li key={a} className="bullet bullet--warning">
                {a}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {catalog && (
        <Card
          title="Starting scorecard (simulated)"
          subtitle="Thresholds are game constructs, not CMS cut points. Headroom is the plausible two-year gain."
          flush
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Measure</th>
                  <th className="num">Weight</th>
                  <th className="num">Start</th>
                  <th>Stars</th>
                  <th>Thresholds</th>
                  <th>Two-year headroom</th>
                </tr>
              </thead>
              <tbody>
                {p.baseline.map((b) => {
                  const m = measures.get(b.id)
                  if (!m) return null
                  return (
                    <tr key={b.id}>
                      <td>
                        <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
                          <span className="code-chip">{m.code}</span>
                          <span className="strong">{m.name}</span>
                        </div>
                        <div className="xs muted">
                          Part {m.part} · {m.domain}
                        </div>
                      </td>
                      <td className="num">×{m.weight}</td>
                      <td className="num strong">{measureValue(b.value, m.unit_kind)}</td>
                      <td>
                        <StarRating value={b.stars} />
                      </td>
                      <td className="xs secondary" style={{ maxWidth: 280 }}>
                        {m.thresholds_text}
                      </td>
                      <td className="small">{b.headroom_text}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid grid-2">
        {catalog && (
          <Card
            title="Leading indicators today"
            subtitle="These move first — measures follow a rating year later"
          >
            <div className="kpi-grid">
              {catalog.kpis
                .filter((k) => k.id !== 'copilot_adoption')
                .map((k) => (
                  <div key={k.id} className="kpi">
                    <span className="kpi__value num">{kpiValue(p.kpis[k.id] ?? 0, k.unit)}</span>
                    <span className="kpi__label">{k.name}</span>
                  </div>
                ))}
            </div>
          </Card>
        )}
        <Card
          title="Leadership tensions"
          subtitle="Disagreement is intended — make the trade-off explicit"
        >
          <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            {p.conflict_hooks.map((h, i) => (
              <div key={i} className="tension">
                <div className="row wrap" style={{ '--gap': '6px' } as React.CSSProperties}>
                  {(h.roles as string[]).map((r, j) => (
                    <span key={r} className="row" style={{ '--gap': '6px' } as React.CSSProperties}>
                      {j > 0 && <span className="muted xs">vs</span>}
                      <Badge tone="accent">{r}</Badge>
                    </span>
                  ))}
                </div>
                <p className="small secondary">{String(h.tension)}</p>
              </div>
            ))}
            {p.segments.map((s) => (
              <Callout key={s.id} title={`${s.name}: ${s.starting_stars.toFixed(1)} Stars`}>
                {s.members.toLocaleString()} members.
                {s.target_stars != null &&
                  ` The board wants this contract at ${s.target_stars.toFixed(1)} within ${s.target_cycles} cycles.`}
              </Callout>
            ))}
          </div>
        </Card>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Link to="/team/dataroom" className="btn btn--primary btn--lg">
          <Building2 aria-hidden /> Open the data room <ArrowRight aria-hidden />
        </Link>
      </div>
    </div>
  )
}
