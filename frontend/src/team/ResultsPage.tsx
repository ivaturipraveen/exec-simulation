import { ArrowDownRight, ArrowRight, ArrowUpRight, Bot, Minus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useResults } from '../api/hooks'
import type { KpiSeries, MeasureResult, TeamView, YearReport } from '../api/types'
import { CapacityPlan } from '../components/CapacityPlan'
import { StageBanner } from '../components/StageBanner'
import { TrendChart } from '../components/charts'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import {
  Badge,
  Callout,
  Empty,
  Loading,
  PageHeader,
  Progress,
  StarRating,
  Stat,
} from '../components/ui/primitives'
import { Tabs } from '../components/ui/Tabs'
import { kpiValue, measureDelta, measureValue, money, pct } from '../lib/format'

const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)']

export function ResultsPage({ team }: { team: TeamView }) {
  const years = team.flags.results_years
  const [year, setYear] = useState(years[years.length - 1] ?? 1)
  const y1 = useResults(1, years.includes(1))
  const y2 = useResults(2, years.includes(2))
  if (years.length === 0 && (team.flags.results_pending ?? []).length > 0)
    return (
      <Empty title="Results are being reviewed">
        Year {team.flags.results_pending?.[0]} has been simulated. Your facilitator is checking the
        results and will release them to every team at the same time.
      </Empty>
    )
  if (years.length === 0)
    return (
      <Empty title="No results yet">
        Results appear after your facilitator runs the Year 1 simulation. Leading indicators move
        first; measures follow a rating year later.
      </Empty>
    )
  const report = year === 2 ? y2.data : y1.data
  if (!report) return <Loading label="Building your performance review…" />

  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <PageHeader
        eyebrow="Executive performance review · simulated / projected"
        title={`Year ${year} performance review`}
        description={`Leading indicators move the quarter after a card goes live; measures move in the next rating year. Projected values carry a ±${Math.round(report.confidence_band * 100)}% band on the effect.`}
        actions={
          years.length > 1 && (
            <Tabs
              label="Year"
              value={String(year)}
              onChange={(v) => setYear(Number(v))}
              tabs={years.map((y) => ({ id: String(y), label: `Year ${y}` }))}
            />
          )
        }
      />
      <StageBanner team={team} compact />
      <StarsTiles report={report} />
      {(report.clues.length > 0 || report.unintended.length > 0) && (
        <div className="grid grid-2">
          {report.clues.length > 0 && (
            <Callout tone="accent" title="What the evidence is telling you">
              <ul className="bullets">
                {report.clues.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Callout>
          )}
          {report.unintended.length > 0 && (
            <Callout tone="warning" title="Unintended consequences and drift">
              <ul className="bullets">
                {report.unintended.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Callout>
          )}
        </div>
      )}
      <KpiSection report={report} />
      <InitiativesCard report={report} />
      <MeasuresTable measures={report.measures} year={year} band={report.confidence_band} />
      <div className="grid grid-split">
        <Card title="Capacity by quarter" subtitle={`Peak ${pct(report.capacity_peak)} of supply`}>
          <CapacityPlan
            cap={team.rules.capacity_overrun_cap}
            utilization={report.quarters.map((q) => q.capacity_utilization)}
            labels={report.quarters.map((q) => q.label)}
          />
          {report.overrun_quarters > 0 && (
            <Callout
              tone="critical"
              title={`${report.overrun_quarters} quarter(s) above ${Math.round(team.rules.capacity_overrun_cap * 100)}%`}
            >
              Everything progressed at half speed in those quarters, and AI maturity is capped at 50
              on the scorecard.
            </Callout>
          )}
        </Card>
        <Card title="Financials" subtitle="Two-year capital envelope plus run costs">
          <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            <Row
              label="Capital spent"
              value={`${money(report.financials.capital_spent_musd)} of ${money(report.financials.committed_musd)} committed`}
            />
            <Row label="Run cost to date" value={money(report.financials.opex_musd)} />
            <Row
              label="Run-rate savings"
              value={`${money(report.financials.savings_run_rate_musd)} / yr`}
            />
            {report.financials.written_off_musd > 0 && (
              <Row label="Written off" value={money(report.financials.written_off_musd)} />
            )}
            <div className="divider" />
            <Row
              label="4-Star bonus value (illustrative)"
              value={`${money(report.financials.bonus_value_musd)} / yr`}
            />
            <div>
              <div className="row spread small">
                <span className="secondary">Progress to the bonus</span>
                <span className="num strong">{pct(report.financials.bonus_progress)}</span>
              </div>
              <Progress
                value={report.financials.bonus_progress}
                label="Progress to the 4-Star bonus"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="row spread small">
    <span className="secondary">{label}</span>
    <span className="num strong">{value}</span>
  </div>
)

function StarsTiles({ report }: { report: YearReport }) {
  const s = report.stars
  return (
    <div className="grid grid-4">
      <Stat
        label="Starting rating"
        value={s.baseline.toFixed(1)}
        meta={<StarRating value={s.baseline} />}
      />
      <Stat
        label={`Year ${report.year} rating`}
        value={s.year_rating.toFixed(1)}
        meta={<span>Lagged: measures realize a share of the effect each rating year</span>}
      />
      <Stat
        label="Projected path"
        value={s.projected.toFixed(1)}
        meta={
          <span>
            Band {s.projected_low.toFixed(1)}–{s.projected_high.toFixed(1)} · score{' '}
            {s.projected_score.toFixed(2)}
          </span>
        }
      />
      <Stat
        label="Target"
        value={s.target.toFixed(1)}
        meta={
          <>
            {s.projected >= s.target ? (
              <Badge tone="good">On track</Badge>
            ) : (
              <span>{(s.target - s.projected).toFixed(1)} to go</span>
            )}
            {report.segments.map((g) => (
              <div key={g.id} className="xs">
                {g.name}: {g.baseline.toFixed(1)} → {g.year_rating.toFixed(1)} →{' '}
                {g.projected.toFixed(1)}
              </div>
            ))}
          </>
        }
      />
    </div>
  )
}

function KpiSection({ report }: { report: YearReport }) {
  const [chosen, setChosen] = useState<string[] | null>(null)
  const percentKpis = report.kpis.filter((k) => k.unit === '%')
  const moved = [...percentKpis].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const ids = chosen ?? moved.slice(0, 4).map((k) => k.id)
  const series = ids
    .map((id, i) => {
      const k = report.kpis.find((x) => x.id === id)
      return k && { key: k.id, label: k.name, color: SERIES_COLORS[i] }
    })
    .filter(Boolean) as { key: string; label: string; color: string }[]
  const data = useMemo(
    () =>
      report.quarters.map((q, i) => {
        const row: Record<string, number | string> = { q: q.label }
        for (const k of report.kpis) row[k.id] = k.values[i] ?? k.current
        return row
      }),
    [report],
  )
  const toggle = (id: string) =>
    setChosen((c) => {
      const cur = c ?? ids
      return cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 4 ? cur : [...cur, id]
    })
  return (
    <div className="grid grid-split">
      <Card
        title="Leading indicators by quarter"
        subtitle="Percent KPIs on one axis — pick up to four"
      >
        <TrendChart
          data={data}
          xKey="q"
          series={series}
          format={(v) => `${v.toFixed(0)}%`}
          domain={[0, 100]}
        />
        <div className="chip-list" style={{ marginTop: 10 }}>
          {percentKpis.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`chip ${ids.includes(k.id) ? 'chip--on' : ''}`}
              onClick={() => toggle(k.id)}
            >
              {k.name}
            </button>
          ))}
        </div>
      </Card>
      <Card title="All leading KPIs" subtitle="Start → now" flush>
        <table className="table table--compact">
          <tbody>
            {report.kpis.map((k) => (
              <KpiRow key={k.id} k={k} />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function KpiRow({ k }: { k: KpiSeries }) {
  const better = k.higher_is_better ? k.delta > 0.05 : k.delta < -0.05
  const worse = k.higher_is_better ? k.delta < -0.05 : k.delta > 0.05
  return (
    <tr>
      <td className="small">{k.name}</td>
      <td className="num muted small">{kpiValue(k.baseline, k.unit)}</td>
      <td className="num strong small">{kpiValue(k.current, k.unit)}</td>
      <td className={`num small ${better ? 'delta-up' : worse ? 'delta-down' : 'muted'}`}>
        {Math.abs(k.delta) < 0.05 ? '—' : `${k.delta > 0 ? '+' : ''}${k.delta.toFixed(1)}`}
      </td>
    </tr>
  )
}

function InitiativesCard({ report }: { report: YearReport }) {
  const navigate = useNavigate()
  const context = report.initiatives
    .map(
      (i) =>
        `${i.code} ${i.name}: ${i.live_label ? `live ${i.live_label}` : `${Math.round(i.progress * 100)}% delivered`}, realized ${i.realized_pct ?? 0}% of base. Drivers: ${i.drivers.map((d) => `${d.label} (${d.impact_pct}%)`).join('; ')}`,
    )
    .concat(report.clues.map((c) => `Clue: ${c}`))
    .join('\n')
  return (
    <Card
      title="Result drivers by card"
      subtitle="Which cards moved which KPIs and measures, and which multipliers applied"
      actions={
        <Button
          size="sm"
          icon={<Bot />}
          onClick={() => navigate('/team/analyst', { state: { mode: 'explain', context } })}
        >
          Ask the explainer
        </Button>
      }
      flush
    >
      {report.initiatives.length === 0 ? (
        <Empty title="No cards funded" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Card</th>
                <th>Status</th>
                <th className="num">Realized</th>
                <th>Moved</th>
                <th>Why (main drivers)</th>
              </tr>
            </thead>
            <tbody>
              {report.initiatives.map((i) => (
                <tr key={i.investment_id}>
                  <td>
                    <div>
                      <span className="code-chip">{i.code}</span>{' '}
                      <span className="strong">{i.name}</span>
                    </div>
                    <div className="xs muted">
                      Round {i.funded_round}
                      {i.owner && ` · ${i.owner}`}
                    </div>
                  </td>
                  <td className="small">
                    {i.live_label ? (
                      <Badge tone="good">Live {i.live_label}</Badge>
                    ) : (
                      <span>{Math.round(i.progress * 100)}% built</span>
                    )}
                    {i.status !== 'active' && <div className="xs muted">{i.status}</div>}
                  </td>
                  <td className="num strong">
                    {i.realized_pct != null ? `${i.realized_pct.toFixed(0)}%` : '—'}
                  </td>
                  <td className="small">
                    {i.contributions.map((c) => (
                      <div key={c.measure} className="num">
                        {c.code} {c.realized > 0 ? '+' : ''}
                        {c.realized.toFixed(2)}
                      </div>
                    ))}
                    {i.kpi_effects.map((k) => (
                      <div key={k} className="xs muted">
                        {k}
                      </div>
                    ))}
                    {!i.contributions.length && !i.kpi_effects.length && (
                      <span className="muted">Enabler</span>
                    )}
                  </td>
                  <td>
                    <div className="driver-list">
                      {i.drivers.slice(0, 4).map((d) => (
                        <div key={d.label} className="driver">
                          <span className={`num ${d.impact_pct >= 0 ? 'delta-up' : 'delta-down'}`}>
                            {d.impact_pct > 0 ? '+' : ''}
                            {d.impact_pct.toFixed(0)}%
                          </span>
                          <span>{d.label}</span>
                        </div>
                      ))}
                      {i.drivers.length === 0 && <span className="muted small">Full effect</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

const DirIcon = ({ d }: { d: string }) =>
  d === 'up' ? (
    <ArrowUpRight size={15} className="direction-up" aria-label="improving" />
  ) : d === 'down' ? (
    <ArrowDownRight size={15} className="direction-down" aria-label="worsening" />
  ) : (
    <Minus size={15} className="muted" aria-label="flat" />
  )

function MeasuresTable({
  measures,
  year,
  band,
}: {
  measures: MeasureResult[]
  year: number
  band: number
}) {
  return (
    <Card
      title="Measures"
      subtitle={`Start → Year ${year} rating value → projected (±${Math.round(band * 100)}% of effect)`}
      flush
    >
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Measure</th>
              <th className="num">Weight</th>
              <th className="num">Start</th>
              <th className="num">Year {year}</th>
              <th className="num">Projected</th>
              <th>Stars</th>
              <th className="num">To next star</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {measures.map((m) => (
              <tr key={m.id}>
                <td>
                  <span className="code-chip">{m.code}</span>{' '}
                  <span className="strong">{m.name}</span>
                  <div className="xs muted">
                    Lift {measureDelta(m.lift, m.unit_kind)} · {pct(Math.max(0, m.lift_share))} of
                    headroom
                  </div>
                </td>
                <td className="num muted">×{m.weight}</td>
                <td className="num">{measureValue(m.baseline, m.unit_kind)}</td>
                <td className="num">{measureValue(m.year_value, m.unit_kind)}</td>
                <td className="num strong">
                  {measureValue(m.projected, m.unit_kind)}
                  {m.band > 0 && (
                    <span className="xs muted">
                      {' '}
                      ±{m.band.toFixed(m.unit_kind === 'rate' ? 2 : 1)}
                    </span>
                  )}
                </td>
                <td>
                  <span className="row" style={{ '--gap': '6px' } as React.CSSProperties}>
                    <StarRating value={m.baseline_stars} />
                    {m.projected_stars !== m.baseline_stars && (
                      <>
                        <ArrowRight size={13} aria-hidden />
                        <StarRating value={m.projected_stars} />
                      </>
                    )}
                  </span>
                </td>
                <td className="num small muted">
                  {m.next_star_gap == null
                    ? '5★'
                    : measureDelta(m.next_star_gap, m.unit_kind).replace('+', '')}
                </td>
                <td>
                  <DirIcon d={m.direction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
