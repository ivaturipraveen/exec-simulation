import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  flush?: boolean
  selected?: boolean
  interactive?: boolean
}

export function Card({
  title,
  subtitle,
  actions,
  flush,
  selected,
  interactive,
  className = '',
  children,
  ...rest
}: CardProps) {
  const cls = ['card', selected && 'card--selected', interactive && 'card--interactive', className]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls} {...rest}>
      {(title || actions) && (
        <div className="card__header">
          <div className="grow">
            {title && <div className="card__title">{title}</div>}
            {subtitle && <div className="card__subtitle">{subtitle}</div>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={flush ? 'card__body card__body--flush' : 'card__body'}>{children}</div>
    </div>
  )
}
