import { AlertTriangle, CheckCircle2, Info, OctagonAlert, Star, Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'good' | 'warning' | 'critical'

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
  return (
    <div className="card stat">
      <div className="stat__label">
        {icon}
        {label}
      </div>
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

export function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${value} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => {
        const fill = Math.max(0, Math.min(1, value - i))
        return (
          <span key={i} style={{ position: 'relative', display: 'inline-flex' }}>
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
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div className="grow">
        {eyebrow && <div className="page-header__eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="page-header__desc">{description}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </header>
  )
}
