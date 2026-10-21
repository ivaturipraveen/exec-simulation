/** Slowest typing speed, in characters a second. A trickle from the model still reads as typing. */
export const MIN_CPS = 45
/** Fastest typing speed, so a very large backlog does not turn into a wall of text in one frame. */
export const MAX_CPS = 900
/**
 * The typing speed is the backlog divided by this, so the backlog shrinks smoothly (it falls by about
 * two thirds every CATCH_UP_SECONDS). A long text that arrives all at once is fully typed in roughly
 * two to three seconds; a model writing a few characters at a time types at the minimum pace.
 */
export const CATCH_UP_SECONDS = 0.6

export interface TypeStep {
  /** How many characters of the text are showing. */
  shown: number
  /** The fraction of a character not yet shown, carried to the next frame. */
  carry: number
}

/** Typing speed in characters a second for a backlog: steady when small, faster when behind. */
export function speed(backlog: number): number {
  return Math.min(MAX_CPS, Math.max(MIN_CPS, backlog / CATCH_UP_SECONDS))
}

/**
 * One frame of typing. `dtMs` is the time since the last frame. The result never passes the end of
 * `text`, and never stops in the middle of a character that takes two code units (an emoji).
 */
export function step(shown: number, text: string, dtMs: number, carry = 0): TypeStep {
  if (shown >= text.length) return { shown: text.length, carry: 0 }
  const wanted = speed(text.length - shown) * (dtMs / 1000) + carry
  const whole = Math.floor(wanted)
  let next = Math.min(text.length, shown + whole)
  const last = text.charCodeAt(next - 1)
  if (next < text.length && last >= 0xd800 && last <= 0xdbff) next += 1 // do not split a surrogate pair
  return { shown: next, carry: next >= text.length ? 0 : wanted - whole }
}

/** How many leading characters two texts share. */
export function commonPrefix(a: string, b: string): number {
  const n = Math.min(a.length, b.length)
  let i = 0
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++
  return i
}
