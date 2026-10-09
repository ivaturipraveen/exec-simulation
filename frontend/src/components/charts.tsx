import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface Series {
  key: string
  label: string
  color: string
}

const axisTick = { fill: 'var(--text-muted)', fontSize: 11.5 }

function TooltipBox({
  active,
  payload,
  label,
  format,
  series,
}: {
  active?: boolean
  payload?: { dataKey: string; value: number }[]
  label?: string
  format: (v: number) => string
  series?: Series[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="strong small">{label}</div>
      {payload.map((p) => {
        const s = series?.find((x) => x.key === p.dataKey)
        return (
          <div
            key={p.dataKey}
            className="row small"
            style={{ '--gap': '6px' } as React.CSSProperties}
          >
            {s && <span className="pill-dot" style={{ background: s.color }} />}
            <span className="secondary grow">{s?.label ?? p.dataKey}</span>
            <span className="num strong">{format(p.value)}</span>
          </div>
        )
      })}
    </div>
  )
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="chart-legend list-reset">
      {series.map((s) => (
        <li key={s.key}>
          <span className="chart-legend__swatch" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  )
}

/** Multi-series trend on a single axis. */
export function TrendChart({
  data,
  xKey,
  series,
  format,
  domain,
  height = 260,
}: {
  data: Record<string, number | string>[]
  xKey: string
  series: Series[]
  format: (v: number) => string
  domain?: [number, number]
  height?: number
}) {
  return (
    <figure className="chart" style={{ margin: 0 }}>
      {series.length > 1 && <Legend series={series} />}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey={xKey}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: 'var(--axis)' }}
          />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={format}
            domain={domain ?? ['auto', 'auto']}
          />
          <Tooltip
            content={<TooltipBox format={format} series={series} />}
            cursor={{ stroke: 'var(--axis)' }}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 4, fill: s.color, stroke: 'var(--surface)', strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </figure>
  )
}

/** Single-series horizontal bars with end labels. */
export function BarList({
  data,
  format,
  domain = [0, 100],
  color = 'var(--series-1)',
  reference,
  height,
}: {
  data: { label: string; value: number }[]
  format: (v: number) => string
  domain?: [number, number]
  color?: string
  reference?: { value: number; label: string }
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height ?? data.length * 40 + 24}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 48, bottom: 4, left: 0 }}
        barCategoryGap={10}
      >
        <CartesianGrid horizontal={false} stroke="var(--grid)" />
        <XAxis
          type="number"
          domain={domain}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          tickFormatter={format}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ ...axisTick, fill: 'var(--text-2)' }}
          tickLine={false}
          axisLine={{ stroke: 'var(--axis)' }}
          width={180}
        />
        <Tooltip
          content={<TooltipBox format={format} />}
          cursor={{ fill: 'var(--surface-sunken)' }}
        />
        {reference && (
          <ReferenceLine
            x={reference.value}
            stroke="var(--text-muted)"
            strokeDasharray="3 3"
            label={{
              value: reference.label,
              position: 'top',
              fill: 'var(--text-muted)',
              fontSize: 11,
            }}
          />
        )}
        <Bar
          dataKey="value"
          fill={color}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
          maxBarSize={22}
        >
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v: number) => format(v)}
            style={{ fill: 'var(--text)', fontSize: 12, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Grouped horizontal bars for up to three entities (validated all-pairs slots 1–3). */
export function GroupedBars({
  data,
  series,
  format,
  domain = [0, 100],
}: {
  data: Record<string, number | string>[]
  series: Series[]
  format: (v: number) => string
  domain?: [number, number]
}) {
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <Legend series={series} />
      <ResponsiveContainer width="100%" height={data.length * (series.length * 18 + 22) + 30}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 40, bottom: 4, left: 0 }}
          barGap={2}
          barCategoryGap={14}
        >
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis
            type="number"
            domain={domain}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={format}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ ...axisTick, fill: 'var(--text-2)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--axis)' }}
            width={190}
          />
          <Tooltip
            content={<TooltipBox format={format} series={series} />}
            cursor={{ fill: 'var(--surface-sunken)' }}
          />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={s.color}
              radius={[0, 4, 4, 0]}
              maxBarSize={16}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </figure>
  )
}
