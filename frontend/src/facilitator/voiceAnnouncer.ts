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

// Browsers load voices asynchronously; ask early so the first announcement already has them.
if (voiceSupported) {
  window.speechSynthesis.getVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', () =>
    window.speechSynthesis.getVoices(),
  )
}

/** Female English voices by name across macOS/iOS, Chrome, Edge/Windows and Android. */
const FEMALE =
  /female|samantha|ava|allison|susan|zoe|karen|moira|tessa|serena|victoria|fiona|kate|nicky|joanna|salli|kendra|kimberly|aria|jenny|zira|michelle|emma|libby|sonia|natasha|google us english|google uk english female/i
const MALE =
  /\bmale\b|daniel|alex|fred|tom\b|aaron|arthur|guy|david|mark|ryan|eric|oliver|george|google uk english male/i
const QUALITY = /natural|neural|premium|enhanced|google/i

/** A female English voice when the device has one, the best available otherwise. */
function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'))
  const female = voices.filter((v) => FEMALE.test(v.name) && !MALE.test(v.name))
  return (
    female.find((v) => v.lang === 'en-US' && QUALITY.test(v.name)) ??
    female.find((v) => v.lang === 'en-US') ??
    female[0] ??
    voices.find((v) => v.lang === 'en-US' && !MALE.test(v.name)) ??
    voices.find((v) => v.lang === 'en-US') ??
    voices[0]
  )
}

/**
 * Speak `text`. Queued after anything already being read, unless `interrupt` is set: then
 * whatever is playing stops first (a new stage, or the facilitator replaying the line).
 */
export function speak(text: string, { interrupt = false }: { interrupt?: boolean } = {}): void {
  if (!('speechSynthesis' in window) || !text.trim()) return
  const synth = window.speechSynthesis
  if (interrupt) synth.cancel()
  // Chrome can leave the engine paused after a while, which silently drops new speech.
  synth.resume?.()
  const u = new SpeechSynthesisUtterance(text)
  const voice = pickVoice()
  if (voice) u.voice = voice
  u.lang = voice?.lang ?? 'en-US'
  u.rate = 0.95
  synth.speak(u)
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
    // A new stage replaces anything still being read about the last one.
    if (enabled) speak(stageAnnouncement(session, clock.stage_index), { interrupt: true })
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
