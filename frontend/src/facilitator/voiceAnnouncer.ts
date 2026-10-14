import { useEffect, useRef, useState } from 'react'
import type { SessionView } from '../api/types'
import { storage } from '../lib/storage'
import { useRemaining } from '../lib/useRemaining'

/**
 * Voice announcer for the room: the browser reads each stage's opening line when the stage
 * starts, then calls out the time left. Runs on the facilitator console (the device on the room
 * speakers); uses the built-in Web Speech API, so nothing leaves the browser.
 */

const KEY = 'execsim.voice'
const WARNINGS = [5 * 60, 60, 0] // seconds left at which the time is called out

export const voiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'))
  return (
    voices.find((v) => /natural|neural|google/i.test(v.name) && v.lang === 'en-US') ??
    voices.find((v) => v.lang === 'en-US') ??
    voices[0]
  )
}

/** Speak now (queued after anything already being read). */
export function speak(text: string): void {
  if (!('speechSynthesis' in window) || !text.trim()) return
  const u = new SpeechSynthesisUtterance(text)
  const voice = pickVoice()
  if (voice) u.voice = voice
  u.lang = voice?.lang ?? 'en-US'
  u.rate = 0.95
  window.speechSynthesis.speak(u)
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export function useVoiceEnabled(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => voiceSupported && storage.get(KEY) !== '0')
  const set = (next: boolean) => {
    storage.set(KEY, next ? '1' : '0')
    if (!next) stopSpeaking()
    setOn(next)
  }
  return [on, set]
}

function minutes(seconds: number): string {
  const m = Math.round(seconds / 60)
  return m === 1 ? 'one minute' : `${m} minutes`
}

/** The opening announcement for a stage: its number, title, time box and transition line. */
export function stageAnnouncement(session: SessionView, index: number): string {
  const stage = session.stages[index]
  if (!stage) return ''
  const parts = [
    `Stage ${index + 1} of ${session.stages.length}: ${stage.title}.`,
    `You have ${minutes(stage.duration_minutes * 60)}.`,
    stage.transition_script,
  ]
  return parts.filter(Boolean).join(' ')
}

/** Announces stage starts and time warnings while `enabled`. Nothing replays on page load. */
export function useStageAnnouncer(session: SessionView, enabled: boolean): void {
  const clock = session.clock
  const remaining = useRemaining(clock)
  const last = useRef<number | null>(null)
  // What is already under way when the console opens counts as announced (reopening is silent).
  const [seen] = useState(() => {
    const s = new Set<string>()
    if (clock.status !== 'not_started') s.add(`${clock.stage_index}:start`)
    for (const w of WARNINGS) if (clock.remaining_seconds <= w) s.add(`${clock.stage_index}:${w}`)
    return s
  })

  useEffect(() => {
    if (clock.status !== 'running') return
    const key = `${clock.stage_index}:start`
    if (seen.has(key)) return
    seen.add(key)
    if (enabled) speak(stageAnnouncement(session, clock.stage_index))
  }, [clock.stage_index, clock.status, enabled, session, seen])

  useEffect(() => {
    const prev = last.current
    last.current = remaining
    if (remaining == null || prev == null || clock.status !== 'running') return
    for (const w of WARNINGS) {
      const key = `${clock.stage_index}:${w}`
      if (w >= clock.duration_seconds || seen.has(key) || !(prev > w && remaining <= w)) continue
      seen.add(key)
      if (!enabled) continue
      speak(
        w === 0
          ? `Time is up for ${clock.stage_title}.`
          : `${minutes(w)} remaining in ${clock.stage_title}.`.replace(/^./, (c) =>
              c.toUpperCase(),
            ),
      )
    }
  }, [
    remaining,
    clock.stage_index,
    clock.stage_title,
    clock.status,
    clock.duration_seconds,
    enabled,
    seen,
  ])
}
