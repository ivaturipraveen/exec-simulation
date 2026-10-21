import { afterEach, describe, expect, it } from 'vitest'
import { canScrollInDirection, shouldBlockWheel } from './wheelGuard'

/** An element with the scroll measurements a browser would report (jsdom does no layout). */
function box(
  parent: HTMLElement | null,
  opts: {
    overflowY?: string
    scrollHeight?: number
    clientHeight?: number
    scrollTop?: number
  } = {},
): HTMLElement {
  const el = document.createElement('div')
  el.style.overflowY = opts.overflowY ?? 'visible'
  Object.defineProperty(el, 'scrollHeight', { value: opts.scrollHeight ?? 100, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: opts.clientHeight ?? 100, configurable: true })
  el.scrollTop = 0
  Object.defineProperty(el, 'scrollTop', {
    value: opts.scrollTop ?? 0,
    writable: true,
    configurable: true,
  })
  ;(parent ?? document.body).appendChild(el)
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('canScrollInDirection', () => {
  it('is true for a scrolling area with room in that direction', () => {
    const el = box(null, {
      overflowY: 'auto',
      scrollHeight: 500,
      clientHeight: 200,
      scrollTop: 100,
    })
    expect(canScrollInDirection(el, 50)).toBe(true) // down
    expect(canScrollInDirection(el, -50)).toBe(true) // up
  })
  it('is false at the ends', () => {
    const top = box(null, { overflowY: 'auto', scrollHeight: 500, clientHeight: 200, scrollTop: 0 })
    expect(canScrollInDirection(top, -50)).toBe(false)
    const end = box(null, {
      overflowY: 'auto',
      scrollHeight: 500,
      clientHeight: 200,
      scrollTop: 300,
    })
    expect(canScrollInDirection(end, 50)).toBe(false)
  })
  it('is false when nothing overflows, or the element does not scroll', () => {
    expect(canScrollInDirection(box(null, { overflowY: 'auto' }), 50)).toBe(false)
    expect(
      canScrollInDirection(
        box(null, { overflowY: 'hidden', scrollHeight: 500, clientHeight: 200 }),
        50,
      ),
    ).toBe(false)
    expect(
      canScrollInDirection(
        box(null, { overflowY: 'visible', scrollHeight: 500, clientHeight: 200 }),
        50,
      ),
    ).toBe(false)
  })
})

describe('shouldBlockWheel', () => {
  const panel = () => box(null, { overflowY: 'hidden' })

  it('blocks a wheel over a part of the panel that does not scroll (header, input box)', () => {
    const root = panel()
    const header = box(root)
    expect(shouldBlockWheel(header, root, 120)).toBe(true)
    expect(shouldBlockWheel(header, root, -120)).toBe(true)
  })

  it('lets a wheel scroll the conversation while it still has room', () => {
    const root = panel()
    const thread = box(root, {
      overflowY: 'auto',
      scrollHeight: 900,
      clientHeight: 300,
      scrollTop: 100,
    })
    const bubble = box(thread)
    expect(shouldBlockWheel(bubble, root, 120)).toBe(false)
    expect(shouldBlockWheel(bubble, root, -120)).toBe(false)
  })

  it('blocks a wheel that has reached the end of the conversation, so it cannot reach the page', () => {
    const root = panel()
    const thread = box(root, {
      overflowY: 'auto',
      scrollHeight: 900,
      clientHeight: 300,
      scrollTop: 600,
    })
    expect(shouldBlockWheel(thread, root, 120)).toBe(true) // at the bottom, still going down
    expect(shouldBlockWheel(thread, root, -120)).toBe(false) // but it can go back up
  })

  it('lets a long question box scroll itself', () => {
    const root = panel()
    const field = box(root, {
      overflowY: 'auto',
      scrollHeight: 400,
      clientHeight: 100,
      scrollTop: 0,
    })
    expect(shouldBlockWheel(field, root, 120)).toBe(false)
  })

  it('does nothing for a gesture with no vertical movement', () => {
    const root = panel()
    expect(shouldBlockWheel(box(root), root, 0)).toBe(false)
  })

  it('blocks when the target is not an element at all', () => {
    expect(shouldBlockWheel(null, panel(), 120)).toBe(true)
  })

  it('does not look past the panel for something to scroll', () => {
    const page = box(null, {
      overflowY: 'auto',
      scrollHeight: 5000,
      clientHeight: 800,
      scrollTop: 50,
    })
    const root = box(page, { overflowY: 'hidden' })
    expect(shouldBlockWheel(box(root), root, 120)).toBe(true) // the page behind could scroll, but is not the panel's
  })
})
