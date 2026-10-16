import { AlertTriangle, CheckCircle2, Info, OctagonAlert, Star, Inbox } from 'lucide-react'
import { useId, type ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'good' | 'warning' | 'critical'

/** The rounded five-point star outline used by lucide's Star icon (24 x 24 viewBox). */
const STAR_PATH =
  'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z'

export function Badge({
  tone = 'neutral',
  icon,
  children,
  outline,
}: {
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
  outline?: boolean
}) {
  const cls = ['badge', tone !== 'neutral' && `badge--${tone}`, outline && 'badge--outline']
    .filter(Boolean)
    .join(' ')
  return (
    <span className={cls}>
      {icon}
      {children}
    </span>
  )
}

const CALLOUT_ICON = {
  neutral: Info,
  accent: Info,
  good: CheckCircle2,
  warning: AlertTriangle,
  critical: OctagonAlert,
}

export function Callout({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: Tone
  title?: ReactNode
  children?: ReactNode
}) {
  const Icon = CALLOUT_ICON[tone]
  return (
    <div
      className={`callout ${tone !== 'neutral' ? `callout--${tone}` : ''}`}
      role={tone === 'critical' ? 'alert' : undefined}
    >
      <Icon aria-hidden />
      <div className="stack" style={{ '--gap': '2px' } as React.CSSProperties}>
        {title && (
          <div className="strong" style={{ color: 'var(--text)' }}>
            {title}
          </div>
        )}
        {children && <div>{children}</div>}
      </div>
    </div>
  )
}

export function Stat({
  label,
  value,
  meta,
  icon,
}: {
  label: ReactNode
  value: ReactNode
  meta?: ReactNode
  icon?: ReactNode
}) {
  if (icon) {
    // With an icon the tile is a row: a large icon badge, then label, value and meta.
    return (
      <div className="card stat stat--icon">
        <span className="stat__icon" aria-hidden>
          {icon}
        </span>
        <div className="stat__body">
          <div className="stat__label">{label}</div>
          <div className="stat__value">{value}</div>
          {meta && <div className="stat__meta">{meta}</div>}
        </div>
      </div>
    )
  }
  return (
    <div className="card stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {meta && <div className="stat__meta">{meta}</div>}
    </div>
  )
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="progress__bar" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label} />
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="empty">
      <Spinner />
      <span>{label}</span>
    </div>
  )
}

export function Empty({
  title,
  children,
  icon,
}: {
  title: ReactNode
  children?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="empty">
      {icon ?? <Inbox aria-hidden />}
      <div className="empty__title">{title}</div>
      {children && <div style={{ maxWidth: 420 }}>{children}</div>}
    </div>
  )
}

export function StarRating({
  value,
  max = 5,
  variant,
}: {
  value: number
  max?: number
  /** `hero`: large gold stars with a glow, for the company header. */
  variant?: 'hero'
}) {
  const gid = useId().replace(/:/g, '')
  if (variant === 'hero') {
    // Gold gradient stars with a soft outline; a partial star is clipped to the exact fraction.
    return (
      <span className="stars stars--hero" role="img" aria-label={`${value} of ${max} stars`}>
        <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
          <defs>
            <linearGradient id={`${gid}-gold`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe08a" />
              <stop offset="1" stopColor="#f2a30f" />
            </linearGradient>
            {Array.from({ length: max }, (_, i) => (
              <clipPath key={i} id={`${gid}-clip${i}`}>
                <rect x="0" y="0" width={24 * Math.max(0, Math.min(1, value - i))} height="24" />
              </clipPath>
            ))}
          </defs>
        </svg>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className="stars__star" style={{ '--i': i } as React.CSSProperties}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path className="stars__outline" d={STAR_PATH} />
              {value - i > 0 && (
                <path
                  className="stars__fill"
                  d={STAR_PATH}
                  fill={`url(#${gid}-gold)`}
                  clipPath={`url(#${gid}-clip${i})`}
                />
              )}
            </svg>
          </span>
        ))}
      </span>
    )
  }
  return (
    <span
      className={variant ? `stars stars--${variant}` : 'stars'}
      role="img"
      aria-label={`${value} of ${max} stars`}
    >
      {Array.from({ length: max }, (_, i) => {
        const fill = Math.max(0, Math.min(1, value - i))
        return (
          <span
            key={i}
            className="stars__star"
            style={
              { position: 'relative', display: 'inline-flex', '--i': i } as React.CSSProperties
            }
          >
            <Star className="stars__empty" fill="currentColor" strokeWidth={0} aria-hidden />
            {fill > 0 && (
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${fill * 100}%`,
                  overflow: 'hidden',
                  display: 'inline-flex',
                }}
              >
                <Star fill="currentColor" strokeWidth={0} aria-hidden />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div className="grow">
        <h1>{title}</h1>
        {description && <p className="page-header__desc">{description}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </header>
  )
}
