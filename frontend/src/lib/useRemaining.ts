import { useEffect, useState } from 'react'
import type { ClockView } from '../api/types'

/** Server-anchored countdown: drift-free because it re-bases on every server snapshot. */
export function useRemaining(clock: ClockView | undefined): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const [anchor, setAnchor] = useState<{ at: number; clock?: ClockView }>({ at: Date.now() })
  useEffect(() => setAnchor({ at: Date.now(), clock }), [clock])
  if (!clock) return null
  const base = anchor.clock ?? clock
  if (base.status !== 'running') return base.remaining_seconds
  return base.remaining_seconds - (now - anchor.at) / 1000
}

/** Seconds left until an absolute deadline (epoch ms), ticking every second. */
export function useSecondsUntil(deadlineMs: number | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadlineMs == null) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [deadlineMs])
  return deadlineMs == null ? null : (deadlineMs - now) / 1000
}
