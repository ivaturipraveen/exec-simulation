import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CalendarCheck,
  Check,
  ChevronDown,
  Hammer,
  Minus,
  Rocket,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useResults } from '../api/hooks'
import type { KpiSeries, MeasureResult, TeamView, YearReport } from '../api/types'
import { CapacityPlan } from '../components/CapacityPlan'
import { StageBanner } from '../components/StageBanner'
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
import { useAnalyst } from './analystContext'
import { KpiTrend, type KpiTrendSeries } from './KpiTrend'
import { kpiValue, measureDelta, measureValue, money, pct } from '../lib/format'

/** Validated categorical slots for the KPI chart (light and dark steps in pages.css). */
const KPI_COLORS = ['var(--kpi-1)', 'var(--kpi-2)', 'var(--kpi-3)', 'var(--kpi-4)']

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
      <YearSummary report={report} />
      {(report.clues.length > 0 || report.unintended.length > 0) && (
        <div
          className={`grid ${report.clues.length > 0 && report.unintended.length > 0 ? 'grid-2' : ''}`}
        >
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
            <div className="bonus-progress">
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

/** The year in one glance: what moved, which cards are live, which are still building, and why
 * Stars move later. Answers "why didn't anything change?" before anyone has to ask. */
function YearSummary({ report }: { report: YearReport }) {
  const moved = report.kpis.filter(hasMoved).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const live = report.initiatives.filter((i) => i.live_label)
  const building = report.initiatives.filter((i) => !i.live_label && i.status !== 'cancelled')
  const enablers = live.filter((i) => !i.kpi_effects.length && !i.contributions.length)
  return (
    <section className="year-summary" aria-label={`Year ${report.year} at a glance`}>
      <div className="year-summary__col">
        <div className="year-summary__label">
          <TrendingUp aria-hidden /> What moved
          <b>{moved.length}</b>
        </div>
        {moved.length ? (
          <ul className="list-reset year-summary__list">
            {moved.slice(0, 4).map((k) => {
              const better = k.higher_is_better ? k.delta > 0 : k.delta < 0
              return (
                <li key={k.id}>
                  <span className="grow">{k.name}</span>
                  <span className="num muted">
                    {kpiValue(k.baseline, k.unit)} → {kpiValue(k.current, k.unit)}
                  </span>
                  <span className={`num strong ${better ? 'delta-up' : 'delta-down'}`}>
                    {k.delta > 0 ? '+' : ''}
                    {k.delta.toFixed(1)}
                  </span>
                </li>
              )
            })}
            {moved.length > 4 && (
              <li className="muted">+{moved.length - 4} more in the KPI table</li>
            )}
          </ul>
        ) : (
          <p className="year-summary__empty">
            No leading KPI moved yet. A card moves its KPIs the quarter after it goes live.
          </p>
        )}
      </div>
      <div className="year-summary__col">
        <div className="year-summary__label">
          <Rocket aria-hidden /> Live cards
          <b>{live.length}</b>
        </div>
        {live.length ? (
          <ul className="list-reset year-summary__list">
            {live.slice(0, 4).map((i) => (
              <li key={i.investment_id}>
                <span className="code-chip">{i.code}</span>
                <span className="grow">{i.name}</span>
                <span className="muted xs">
                  {enablers.includes(i) ? 'enabler' : `live ${i.live_label}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="year-summary__empty">No card has gone live yet.</p>
        )}
      </div>
      <div className="year-summary__col">
        <div className="year-summary__label">
          <Hammer aria-hidden /> Still building
          <b>{building.length}</b>
        </div>
        {building.length ? (
          <ul className="list-reset year-summary__list">
            {building.slice(0, 4).map((i) => (
              <li key={i.investment_id}>
                <span className="code-chip">{i.code}</span>
                <span className="grow">{i.name}</span>
                <span
                  className="year-summary__meter"
                  aria-label={`${Math.round(i.progress * 100)}% built`}
                >
                  <span style={{ width: `${Math.round(i.progress * 100)}%` }} />
                </span>
                <span className="num xs muted">{Math.round(i.progress * 100)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="year-summary__empty">Every funded card is live.</p>
        )}
        <p className="year-summary__note">
          Stars measures follow a rating year later, so the rating can stay flat while KPIs move.
        </p>
      </div>
    </section>
  )
}

function StarsTiles({ report }: { report: YearReport }) {
  const s = report.stars
  return (
    <div className="grid grid-4">
      <Stat
        icon={<Star />}
        label="Starting rating"
        value={s.baseline.toFixed(1)}
        meta={<StarRating value={s.baseline} />}
      />
      <Stat
        icon={<CalendarCheck />}
        label={`Year ${report.year} rating`}
        value={s.year_rating.toFixed(1)}
        meta={<span>Lags the KPIs by a rating year</span>}
      />
      <Stat
        icon={<TrendingUp />}
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
        icon={<Target />}
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

const hasMoved = (k: KpiSeries) => Math.abs(k.delta) >= 0.05

function KpiSection({ report }: { report: YearReport }) {
  // Each shown KPI holds a colour slot (0-3) until it is removed, so adding or removing one line
  // never repaints the others.
  const [slots, setSlots] = useState<Record<string, number> | null>(null)
  const percentKpis = report.kpis.filter((k) => k.unit === '%')
  const movedPercent = percentKpis
    .filter(hasMoved)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  // Moved KPIs first (largest change on top), then the rest in their usual order.
  const rows = [
    ...report.kpis.filter(hasMoved).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    ...report.kpis.filter((k) => !hasMoved(k)),
  ]
  const movedCount = report.kpis.filter(hasMoved).length
  const current: Record<string, number> =
    slots ?? Object.fromEntries(movedPercent.slice(0, 4).map((k, i) => [k.id, i]))
  const ids = Object.keys(current).sort((a, b) => current[a] - current[b])
  const series: KpiTrendSeries[] = ids.flatMap((id) => {
    const k = report.kpis.find((x) => x.id === id)
    if (!k) return []
    return [
      {
        key: k.id,
        label: k.name,
        color: KPI_COLORS[current[id]],
        start: kpiValue(k.baseline, k.unit),
        now: kpiValue(k.current, k.unit),
        delta: k.delta,
        better: hasMoved(k) ? (k.higher_is_better ? k.delta > 0 : k.delta < 0) : null,
      },
    ]
  })
  const data = useMemo(
    () =>
      report.quarters.map((q, i) => {
        const row: Record<string, number | string> = { q: q.label }
        for (const k of report.kpis) row[k.id] = k.values[i] ?? k.current
        return row
      }),
    [report],
  )
  // Fit the axis to the KPIs shown, so a move from 2% to 8% is visible (not lost on 0-100%).
  const domain = useMemo((): [number, number] => {
    const vals = ids.flatMap((id) => {
      const k = report.kpis.find((x) => x.id === id)
      return k ? [k.baseline, ...k.values] : []
    })
    if (!vals.length) return [0, 100]
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    const pad = Math.max(2, (hi - lo) * 0.2)
    return [
      Math.max(0, Math.floor((lo - pad) / 5) * 5),
      Math.min(100, Math.ceil((hi + pad) / 5) * 5),
    ]
  }, [ids, report])
  const toggle = (id: string) =>
    setSlots(() => {
      const next = { ...current }
      if (id in next) {
        delete next[id]
      } else if (Object.keys(next).length < KPI_COLORS.length) {
        const used = new Set(Object.values(next))
        next[id] = KPI_COLORS.findIndex((_, i) => !used.has(i))
      }
      return next
    })
  return (
    <div className="grid grid-split kpi-split">
      <Card
        title="Leading indicators by quarter"
        subtitle={
          movedPercent.length
            ? 'Showing the KPIs that moved — pick up to four'
            : 'No percent KPI moved this year'
        }
      >
        {series.length ? (
          <KpiTrend
            data={data}
            series={series}
            format={(v) => `${v.toFixed(0)}%`}
            domain={domain}
          />
        ) : (
          <div className="kpi-empty">
            <strong>Nothing has moved yet.</strong>
            <span>
              Leading indicators move the quarter after a card goes live. Cards still building, and
              enablers such as governance or data foundations, show up in later quarters or through
              other cards. See “Result drivers by card” below.
            </span>
          </div>
        )}
        {movedPercent.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <KpiPicker
              kpis={percentKpis}
              selected={ids}
              colorOf={(id) => KPI_COLORS[current[id]]}
              max={KPI_COLORS.length}
              onToggle={toggle}
            />
          </div>
        )}
      </Card>
      <Card
        title="All leading KPIs"
        subtitle={`${movedCount} of ${report.kpis.length} moved · start → end of Year ${report.year}`}
        flush
      >
        <table className="table table--compact">
          <thead>
            <tr>
              <th>KPI</th>
              <th>Start</th>
              <th>Now</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <KpiRow key={k.id} k={k} />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

/** Drop-down to choose which KPIs the chart shows (up to `max`), instead of a wall of chips. */
function KpiPicker({
  kpis,
  selected,
  colorOf,
  max,
  onToggle,
}: {
  kpis: KpiSeries[]
  selected: string[]
  colorOf: (id: string) => string
  max: number
  onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const full = selected.length >= max
  return (
    <div className="kpi-picker" ref={ref}>
      <span className="kpi-picker__label">Show on chart:</span>
      <button
        type="button"
        className="kpi-picker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="kpi-picker__count">
          {selected.length} of {max}
        </span>
        <span className="kpi-picker__summary">
          {selected.length ? 'KPIs · change' : 'Pick KPIs'}
        </span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div className="kpi-picker__menu" role="listbox" aria-multiselectable="true">
          <div className="kpi-picker__hint">Pick up to {max} to compare</div>
          {kpis.map((k) => {
            const on = selected.includes(k.id)
            return (
              <button
                key={k.id}
                type="button"
                role="option"
                aria-selected={on}
                className={`kpi-picker__opt ${on ? 'is-on' : ''}`}
                disabled={!on && full}
                onClick={() => onToggle(k.id)}
              >
                <span
                  className="kpi-picker__swatch"
                  style={on ? { background: colorOf(k.id), borderColor: colorOf(k.id) } : undefined}
                  aria-hidden
                >
                  {on && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="kpi-picker__name">{k.name}</span>
                {hasMoved(k) && <span className="chip__dot" aria-label="moved" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function KpiRow({ k }: { k: KpiSeries }) {
  const better = k.higher_is_better ? k.delta > 0.05 : k.delta < -0.05
  const worse = k.higher_is_better ? k.delta < -0.05 : k.delta > 0.05
  return (
    <tr className={hasMoved(k) ? 'kpi-row--moved' : 'kpi-row--flat'}>
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
  const { openAnalyst } = useAnalyst()
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
        <Button size="sm" icon={<Bot />} onClick={() => openAnalyst({ mode: 'explain', context })}>
          Ask the explainer
        </Button>
      }
      flush
    >
      {report.initiatives.length === 0 ? (
        <Empty title="No cards funded" />
      ) : (
        <div className="table-wrap">
          <table className="table drivers-table">
            <colgroup>
              <col className="drivers-table__card" />
              <col className="drivers-table__status" />
              <col className="drivers-table__realized" />
              <col className="drivers-table__moved" />
              <col />
            </colgroup>
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
                    <div className="chip-title">
                      <span className="code-chip">{i.code}</span>
                      <span className="xs muted">
                        Round {i.funded_round}
                        {i.owner && ` · ${i.owner}`}
                      </span>
                    </div>
                    <div className="strong drivers-table__name">{i.name}</div>
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
                  <div className="chip-title">
                    <span className="code-chip">{m.code}</span>
                    <span className="strong">{m.name}</span>
                  </div>
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
