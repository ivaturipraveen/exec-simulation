import { Clock, Pause } from 'lucide-react'
import type { ClockView } from '../api/types'
import { clockText } from '../lib/format'
import { useRemaining } from '../lib/useRemaining'

/** `holdAtZero` (projector) shows 0:00 muted instead of the overrun, which is for the facilitator only. */
export function Countdown({
  clock,
  big,
  holdAtZero,
}: {
  clock: ClockView | undefined
  big?: boolean
  holdAtZero?: boolean
}) {
  const raw = useRemaining(clock)
  const remaining = holdAtZero && raw !== null ? Math.max(0, raw) : raw
  const held = holdAtZero && raw !== null && raw <= 0
  if (!clock || remaining === null) return null
  if (clock.status === 'not_started')
    return <span className="clock clock--paused">Not started</span>
  if (clock.status === 'completed')
    return <span className="clock clock--paused">Session complete</span>
  const paused = clock.status === 'paused'
  const cls = [
    'clock',
    big && 'clock--big',
    (paused || held) && 'clock--paused',
    !paused && remaining < 0 && 'clock--over',
    !paused && remaining >= 0 && remaining < 120 && 'clock--low',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <span
      className={cls}
      role="timer"
      aria-label={`${paused ? 'Paused, ' : ''}${clockText(remaining)} ${remaining < 0 ? 'over time' : 'remaining'}`}
    >
      {!big && (paused ? <Pause aria-hidden /> : <Clock aria-hidden />)}
      {clockText(remaining)}
      {remaining < 0 && !big && <span className="xs">over</span>}
    </span>
  )
}
