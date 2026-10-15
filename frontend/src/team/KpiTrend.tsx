import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface KpiTrendSeries {
  key: string
  label: string
  /** CSS colour (a validated categorical slot, e.g. var(--kpi-1)). */
  color: string
  start: string
  now: string
  delta: number
  better: boolean | null
}

const tick = { fill: 'var(--text-muted)', fontSize: 11.5 }
const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** HUD tooltip: the quarter, then each KPI's value, in text ink beside its colour swatch. */
function HudTooltip({
  active,
  payload,
  label,
  series,
  format,
}: {
  active?: boolean
  payload?: { dataKey: string; value: number }[]
  label?: string
  series: KpiTrendSeries[]
  format: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="kpi-trend__tip">
      <div className="kpi-trend__tip-head">{label}</div>
      {series.map((s) => {
        const p = payload.find((x) => x.dataKey === s.key)
        if (!p) return null
        return (
          <div key={s.key} className="kpi-trend__tip-row">
            <span className="kpi-trend__swatch" style={{ background: s.color }} />
            <span className="kpi-trend__tip-name">{s.label}</span>
            <span className="num strong">{format(p.value)}</span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Leading KPIs by quarter, styled as a game HUD: glowing area lines that draw in, Year 1 /
 * Year 2 zones, a pulsing marker on each line's latest value and a scoreboard legend.
 * One axis; colours come from validated, theme-aware slots and follow the KPI, not its rank.
 */
export function KpiTrend({
  data,
  series,
  domain,
  format,
}: {
  data: Record<string, number | string>[]
  series: KpiTrendSeries[]
  domain: [number, number]
  format: (v: number) => string
}) {
  const labels = data.map((d) => String(d.q))
  const y2 = labels.findIndex((l) => l.startsWith('Y2'))
  const last = data.length - 1
  return (
    <div className="kpi-trend">
      <ul className="list-reset kpi-trend__legend" aria-label="Lines shown">
        {series.map((s) => (
          <li key={s.key} style={{ '--c': s.color } as React.CSSProperties}>
            <span className="kpi-trend__bar" aria-hidden />
            <span className="kpi-trend__name" title={s.label}>
              {s.label}
            </span>
            <span className="kpi-trend__values">
              <span className="muted">
                {s.start} → {s.now}
              </span>
              <b className={s.better === null ? 'muted' : s.better ? 'delta-up' : 'delta-down'}>
                {Math.abs(s.delta) < 0.05 ? '—' : `${s.delta > 0 ? '+' : ''}${s.delta.toFixed(1)}`}
              </b>
            </span>
          </li>
        ))}
      </ul>
      <div className="kpi-trend__plot">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 22, right: 18, bottom: 0, left: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`kpi-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {y2 > 0 && (
              <ReferenceArea
                x1={labels[y2]}
                x2={labels[last]}
                fill="var(--accent)"
                fillOpacity={0.06}
                stroke="none"
                label={{
                  value: 'YEAR 2',
                  position: 'insideTopLeft',
                  className: 'kpi-trend__zone-label',
                }}
              />
            )}
            {y2 > 0 && (
              <ReferenceLine x={labels[y2]} className="kpi-trend__divider" strokeDasharray="4 4" />
            )}
            <ReferenceArea
              x1={labels[0]}
              x2={labels[y2 > 0 ? y2 - 1 : last]}
              fillOpacity={0}
              label={{
                value: 'YEAR 1',
                position: 'insideTopLeft',
                className: 'kpi-trend__zone-label',
              }}
            />
            <CartesianGrid vertical={false} className="kpi-trend__grid" strokeDasharray="3 6" />
            <XAxis dataKey="q" tick={tick} tickLine={false} axisLine={false} dy={6} />
            <YAxis
              tick={tick}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={format}
              domain={domain}
            />
            <Tooltip
              content={<HudTooltip series={series} format={format} />}
              cursor={{ className: 'kpi-trend__cursor', strokeWidth: 1 }}
            />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2.5}
                fill={`url(#kpi-fill-${s.key})`}
                className="kpi-trend__line"
                isAnimationActive={!reduceMotion}
                animationDuration={900}
                animationEasing="ease-out"
                activeDot={{ r: 6, fill: s.color, stroke: 'var(--surface)', strokeWidth: 2 }}
                dot={(props: { cx?: number; cy?: number; index?: number }) => {
                  const { cx, cy, index } = props
                  if (index !== last || cx == null || cy == null)
                    return <g key={`${s.key}-${index}`} />
                  return (
                    <g key={`${s.key}-end`}>
                      <circle cx={cx} cy={cy} r={11} fill={s.color} className="kpi-trend__pulse" />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={s.color}
                        stroke="var(--surface)"
                        strokeWidth={2}
                      />
                    </g>
                  )
                }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
