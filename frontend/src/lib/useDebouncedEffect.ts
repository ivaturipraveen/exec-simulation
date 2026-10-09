import { useEffect, useRef } from 'react'

/** Runs `fn` after `delay` ms of quiet whenever `deps` change (skips the first render). */
export function useDebouncedEffect(fn: () => void, deps: unknown[], delay = 700) {
  const first = useRef(true)
  const saved = useRef(fn)
  saved.current = fn
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = window.setTimeout(() => saved.current(), delay)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
