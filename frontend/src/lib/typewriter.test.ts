import { describe, expect, it } from 'vitest'
import { CATCH_UP_SECONDS, MAX_CPS, MIN_CPS, commonPrefix, speed, step } from './typewriter'

describe('speed', () => {
  it('is never below the steady typing pace or above the ceiling', () => {
    expect(speed(0)).toBe(MIN_CPS)
    expect(speed(3)).toBe(MIN_CPS)
    expect(speed(10_000_000)).toBe(MAX_CPS)
  })
  it('speeds up in proportion to the backlog, between those limits', () => {
    expect(speed(300)).toBe(300 / CATCH_UP_SECONDS)
    expect(speed(450)).toBeGreaterThan(speed(150))
  })
})

describe('step', () => {
  it('types a trickle at the minimum pace', () => {
    // 3 characters waiting, one 1-second frame: the end of the text stops it, not the pace
    expect(step(0, 'abc', 1000)).toEqual({ shown: 3, carry: 0 })
    // 20 waiting is a small backlog, so the minimum pace applies: 100ms is four and a half characters
    const r = step(0, 'x'.repeat(20), 100)
    expect(r.shown).toBe(4)
    expect(r.carry).toBeCloseTo(0.5, 5)
  })

  it('carries the fraction of a character to the next frame, so short frames still add up', () => {
    // 45 characters a second at 60 frames a second is 0.75 of a character a frame: with no carry the
    // text would never move at all
    const text = 'x'.repeat(25)
    let shown = 0
    let carry = 0
    for (let i = 0; i < 30; i++) ({ shown, carry } = step(shown, text, 16.6667, carry))
    expect(shown).toBeGreaterThanOrEqual(21) // half a second at 45 a second is about 22
    expect(shown).toBeLessThanOrEqual(23)
  })

  /** Milliseconds to type `n` characters that arrive all at once, at 60 frames a second. */
  const timeToType = (n: number) => {
    const t = 'x'.repeat(n)
    let shown = 0
    let carry = 0
    let ms = 0
    while (shown < t.length && ms < 30_000) {
      ;({ shown, carry } = step(shown, t, 16.67, carry))
      ms += 16.67
    }
    return shown === t.length ? ms : Infinity
  }

  it('types a long text that arrives at once in a few seconds, not tens of seconds', () => {
    expect(timeToType(300)).toBeLessThan(2500)
    expect(timeToType(1000)).toBeGreaterThan(1500)
    expect(timeToType(1000)).toBeLessThan(3500)
    expect(timeToType(3000)).toBeLessThan(6000)
  })

  it('takes longer for more text, but far less than typing it all at the minimum pace', () => {
    expect(timeToType(300)).toBeLessThan(timeToType(1000))
    expect(timeToType(1000)).toBeLessThan((1000 / MIN_CPS) * 1000 * 0.3)
  })

  it('never goes past the end and clears the carry there', () => {
    expect(step(8, 'abcdefghij', 5000)).toEqual({ shown: 10, carry: 0 })
    expect(step(10, 'abcdefghij', 16)).toEqual({ shown: 10, carry: 0 })
    expect(step(50, 'abc', 16)).toEqual({ shown: 3, carry: 0 })
  })

  it('does not stop between the two halves of an emoji', () => {
    const t = 'ab😀cd' // the emoji is two code units, at positions 2 and 3
    for (let shown = 0; shown < t.length; shown++) {
      const next = step(shown, t, 25, 0).shown
      const lastShown = t.charCodeAt(next - 1)
      const splits = next < t.length && lastShown >= 0xd800 && lastShown <= 0xdbff
      expect(splits).toBe(false)
    }
  })

  it('does not move when no time has passed', () => {
    expect(step(5, 'x'.repeat(1000), 0, 0).shown).toBe(5)
  })
})

describe('commonPrefix', () => {
  it('counts the shared start of two texts', () => {
    expect(commonPrefix('hello world', 'hello there')).toBe(6)
    expect(commonPrefix('abc', 'abc and more')).toBe(3)
    expect(commonPrefix('abc', 'xyz')).toBe(0)
    expect(commonPrefix('', 'abc')).toBe(0)
  })
})
