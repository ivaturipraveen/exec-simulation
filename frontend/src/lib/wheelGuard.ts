/** Can this element scroll up or down right now (it overflows, scrolls, and is not already at that end)? */
export function canScrollInDirection(el: HTMLElement, deltaY: number): boolean {
  const overflowY = getComputedStyle(el).overflowY
  if (overflowY !== 'auto' && overflowY !== 'scroll') return false
  if (el.scrollHeight <= el.clientHeight + 1) return false
  return deltaY > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0
}

/**
 * Should a vertical wheel gesture that started on `target` be stopped before it reaches the page
 * behind `root`? Yes, unless something between the target and the root can still use it by scrolling.
 *
 * The CSS `overscroll-behavior: contain` already stops a scrolling area from handing its scroll on at
 * its ends; this covers the parts of the panel that do not scroll at all (its header, its input box),
 * where the browser would otherwise pass the gesture straight to the page.
 */
export function shouldBlockWheel(
  target: EventTarget | null,
  root: HTMLElement,
  deltaY: number,
): boolean {
  if (deltaY === 0) return false
  for (let el = target instanceof HTMLElement ? target : null; el; el = el.parentElement) {
    if (canScrollInDirection(el, deltaY)) return false
    if (el === root) break
  }
  return true
}
