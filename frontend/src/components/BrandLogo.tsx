import logoOnDark from '../assets/brightcone-logo-on-dark.png'
import logoOnLight from '../assets/brightcone-logo-on-light.png'

/**
 * The full brightcone.ai logo in both colorways. Used inside `.login` pages, whose CSS shows the
 * colorway that suits the current theme.
 */
export function BrandLogo({ className, label }: { className: string; label?: boolean }) {
  return (
    <span className={`login__logo ${className}`}>
      <img
        className="login__logo-img login__logo-img--light"
        src={logoOnLight}
        alt={label ? 'Brightcone.ai — Clarity. Focus. Impact' : ''}
        width={647}
        height={150}
        draggable={false}
      />
      <img
        className="login__logo-img login__logo-img--dark"
        src={logoOnDark}
        alt=""
        aria-hidden
        width={647}
        height={150}
        draggable={false}
      />
    </span>
  )
}
