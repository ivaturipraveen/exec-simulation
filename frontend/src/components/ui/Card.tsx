import type { HTMLAttributes, ReactNode } from 'react'
import { iconForTitle } from './cardIcons'

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Header icon. Left out, it follows the title (see cardIcons); `false` shows none. */
  icon?: ReactNode | false
  flush?: boolean
  selected?: boolean
  interactive?: boolean
}

export function Card({
  title,
  subtitle,
  actions,
  icon,
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
  const Auto = typeof title === 'string' ? iconForTitle(title) : null
  const headIcon = icon === false ? null : (icon ?? (Auto && <Auto aria-hidden />))
  return (
    <div className={cls} {...rest}>
      {(title || actions) && (
        <div className="card__header">
          <div className="grow">
            {title && (
              <div className="card__title">
                {headIcon && <span className="card__icon">{headIcon}</span>}
                {title}
              </div>
            )}
            {subtitle && <div className="card__subtitle">{subtitle}</div>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={flush ? 'card__body card__body--flush' : 'card__body'}>{children}</div>
    </div>
  )
}
