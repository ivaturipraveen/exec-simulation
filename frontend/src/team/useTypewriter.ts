import { useEffect, useRef, useState } from 'react'
import { commonPrefix, step } from '../lib/typewriter'

/** True when the person has asked their device for less motion. Read when needed, not subscribed to. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Reveals `target` a few characters at a time, like typing, and keeps up as `target` grows (an answer
 * arriving piece by piece). When `enabled` is false the whole text shows at once.
 *
 * If `target` is replaced by a text that does not start with what is already showing (the final
 * answer differs from the streamed one), the display falls back to the part they share and carries on.
 */
export function useTypewriter(target: string, enabled: boolean): { text: string; typing: boolean } {
  const [shown, setShown] = useState(enabled ? 0 : target.length)
  const state = useRef({ shown: enabled ? 0 : target.length, carry: 0, last: 0, target: '' })

  useEffect(() => {
    if (!enabled) return
    const s = state.current
    if (!target.startsWith(s.target)) s.shown = Math.min(s.shown, commonPrefix(s.target, target))
    s.target = target
    if (s.shown > target.length) s.shown = target.length
    setShown(s.shown)
    if (s.shown >= target.length) return

    let frame = 0
    s.last = 0
    const tick = (now: number) => {
      const dt = s.last ? Math.min(now - s.last, 100) : 16 // a hidden tab must not jump ahead
      s.last = now
      const next = step(s.shown, s.target, dt, s.carry)
      s.shown = next.shown
      s.carry = next.carry
      setShown(next.shown)
      if (next.shown < s.target.length) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, enabled])

  if (!enabled) return { text: target, typing: false }
  const visible = Math.min(shown, target.length)
  return { text: target.slice(0, visible), typing: visible < target.length }
}
