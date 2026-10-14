import onDark from '../assets/brightcone-logo-on-dark.png'
import onLight from '../assets/brightcone-logo-on-light.png'

/**
 * Brightcone.ai wordmark (cone + name). By default it has light lettering for the navy top bars;
 * `followTheme` shows dark lettering in light theme and light lettering in dark theme.
 */
export function BrandWordmark({
  height = 36,
  followTheme = false,
}: {
  height?: number
  followTheme?: boolean
}) {
  const style = { height, width: 'auto' }
  if (!followTheme) {
    return (
      <img
        className="brand-wordmark"
        src={onDark}
        alt="Brightcone.ai"
        height={height}
        style={style}
        draggable={false}
      />
    )
  }
  return (
    <span className="brand-wordmark-pair">
      <img
        className="brand-wordmark brand-wordmark--on-light"
        src={onLight}
        alt="Brightcone.ai"
        height={height}
        style={style}
        draggable={false}
      />
      <img
        className="brand-wordmark brand-wordmark--on-dark"
        src={onDark}
        alt=""
        aria-hidden
        height={height}
        style={style}
        draggable={false}
      />
    </span>
  )
}
