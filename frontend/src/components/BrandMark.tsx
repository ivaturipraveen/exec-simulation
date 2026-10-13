import mark from '../assets/brightcone-mark-128.png'

/** Brightcone.ai cone mark (official artwork). */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span className="brand-logo" style={{ width: size, height: size }} aria-hidden>
      <img src={mark} alt="" width={size} height={size} draggable={false} />
    </span>
  )
}
