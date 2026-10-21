import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTypewriter } from './useTypewriter'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
})
afterEach(() => vi.useRealTimers())

/** Let `ms` of animation frames pass, a frame at a time. */
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

const LONG = 'The complaint log shows outreach errors concentrated in the new counties after March.'

describe('useTypewriter', () => {
  it('shows the text a little at a time, not all at once', () => {
    const { result } = renderHook(() => useTypewriter(LONG, true))
    expect(result.current.text).toBe('')
    expect(result.current.typing).toBe(true)
    wait(200)
    const early = result.current.text
    expect(early.length).toBeGreaterThan(0)
    expect(early.length).toBeLessThan(LONG.length)
    expect(LONG.startsWith(early)).toBe(true)
    wait(200)
    expect(result.current.text.length).toBeGreaterThan(early.length)
  })

  it('finishes, and then reports that it has stopped typing', () => {
    const { result } = renderHook(() => useTypewriter(LONG, true))
    wait(6000)
    expect(result.current.text).toBe(LONG)
    expect(result.current.typing).toBe(false)
  })

  it('keeps up when the target grows, as an answer does while it is being written', () => {
    const { result, rerender } = renderHook(({ t }) => useTypewriter(t, true), {
      initialProps: { t: 'Complaints ' },
    })
    wait(500)
    expect(result.current.text).toBe('Complaints ')
    rerender({ t: 'Complaints rose after the outreach change ' })
    expect(result.current.typing).toBe(true)
    wait(100)
    expect(result.current.text.startsWith('Complaints ')).toBe(true)
    wait(3000)
    expect(result.current.text).toBe('Complaints rose after the outreach change ')
  })

  it('does not start over when more text arrives', () => {
    const { result, rerender } = renderHook(({ t }) => useTypewriter(t, true), {
      initialProps: { t: LONG.slice(0, 40) },
    })
    wait(600)
    const before = result.current.text.length
    expect(before).toBeGreaterThan(5)
    rerender({ t: LONG })
    expect(result.current.text.length).toBeGreaterThanOrEqual(before)
  })

  it('types the different ending of a final text that disagrees with what was streamed', () => {
    const { result, rerender } = renderHook(({ t }) => useTypewriter(t, true), {
      initialProps: { t: 'Complaints rose sharply after the outreach change in March.' },
    })
    wait(700)
    expect(result.current.text.length).toBeGreaterThan(20)
    const final = 'Complaints rose. (Answer truncated: ask a narrower question.)'
    rerender({ t: final })
    wait(10)
    // what shows is the start of the final answer, and only as far as the two versions agree:
    // the different ending is typed from there, not flashed in at once
    expect(final.startsWith(result.current.text)).toBe(true)
    expect(result.current.text.length).toBeLessThanOrEqual('Complaints rose'.length + 2)
    wait(6000)
    expect(result.current.text).toBe(final)
  })

  it('shows everything at once when typing is switched off', () => {
    const { result } = renderHook(() => useTypewriter(LONG, false))
    expect(result.current).toEqual({ text: LONG, typing: false })
  })

  it('shows a longer text at once too when typing is off', () => {
    const { result, rerender } = renderHook(({ t }) => useTypewriter(t, false), {
      initialProps: { t: 'short' },
    })
    rerender({ t: LONG })
    expect(result.current.text).toBe(LONG)
  })

  it('stops its animation when the component goes away', () => {
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
    const { unmount } = renderHook(() => useTypewriter(LONG, true))
    wait(50)
    unmount()
    expect(cancel).toHaveBeenCalled()
  })

  it('shows an empty target as empty and not typing', () => {
    const { result } = renderHook(() => useTypewriter('', true))
    expect(result.current).toEqual({ text: '', typing: false })
  })
})
