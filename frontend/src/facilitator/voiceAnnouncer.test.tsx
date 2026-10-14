import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { SessionView } from '../api/types'
import { stageAnnouncement, useStageAnnouncer } from './voiceAnnouncer'

const spoken: string[] = []

beforeEach(() => {
  vi.useFakeTimers()
  spoken.length = 0
  class Utterance {
    voice: unknown = null
    lang = ''
    rate = 1
    text: string
    constructor(text: string) {
      this.text = text
    }
  }
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => [],
      cancel: () => {},
      speak: (u: { text: string }) => spoken.push(u.text),
    },
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const stages = [
  {
    title: 'Executive setup and briefing',
    duration_minutes: 12,
    transition_script: 'You are the leadership team.',
  },
  {
    title: 'Meet your company',
    duration_minutes: 15,
    transition_script: 'Your briefing is honest.',
  },
]

function session(index: number, status: string, remaining: number): SessionView {
  return {
    stages,
    clock: {
      stage_index: index,
      stage_id: `s${index}`,
      stage_kind: 'briefing',
      stage_title: stages[index].title,
      status,
      duration_seconds: stages[index].duration_minutes * 60,
      elapsed_seconds: 0,
      remaining_seconds: remaining,
      server_time: new Date().toISOString(),
    },
  } as unknown as SessionView
}

test('the stage announcement names the stage, its time and its line', () => {
  expect(stageAnnouncement(session(0, 'running', 720), 0)).toBe(
    'Stage 1 of 2: Executive setup and briefing. You have 12 minutes. You are the leadership team.',
  )
})

test('announces a stage when it starts, but not what was already running on page load', () => {
  const { rerender } = renderHook(({ s }) => useStageAnnouncer(s, true), {
    initialProps: { s: session(0, 'running', 600) },
  })
  expect(spoken).toEqual([])
  rerender({ s: session(1, 'running', 900) })
  expect(spoken).toEqual([
    'Stage 2 of 2: Meet your company. You have 15 minutes. Your briefing is honest.',
  ])
})

test('calls out five minutes, one minute and time up', () => {
  renderHook(({ s }) => useStageAnnouncer(s, true), {
    initialProps: { s: session(1, 'running', 302) },
  })
  act(() => vi.advanceTimersByTime(4000))
  expect(spoken).toEqual(['5 minutes remaining in Meet your company.'])
  act(() => vi.advanceTimersByTime(240_000))
  expect(spoken.at(-1)).toBe('One minute remaining in Meet your company.')
  act(() => vi.advanceTimersByTime(60_000))
  expect(spoken.at(-1)).toBe('Time is up for Meet your company.')
  expect(spoken).toHaveLength(3)
})

test('reads in a female voice when the device has one, and a new stage interrupts the old one', () => {
  const voices = [
    { name: 'Alex', lang: 'en-US' },
    { name: 'Daniel', lang: 'en-GB' },
    { name: 'Samantha', lang: 'en-US' },
  ]
  const used: { voice: unknown }[] = []
  let cancelled = 0
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => voices,
      cancel: () => cancelled++,
      speak: (u: { text: string; voice: unknown }) => {
        spoken.push(u.text)
        used.push(u)
      },
    },
  })
  const { rerender } = renderHook(({ s }) => useStageAnnouncer(s, true), {
    initialProps: { s: session(0, 'not_started', 720) },
  })
  rerender({ s: session(0, 'running', 720) })
  expect(spoken).toHaveLength(1)
  expect(used[0].voice).toBe(voices[2])
  expect(cancelled).toBe(1)
})

test('stays silent when turned off', () => {
  const { rerender } = renderHook(({ s }) => useStageAnnouncer(s, false), {
    initialProps: { s: session(0, 'not_started', 720) },
  })
  rerender({ s: session(0, 'running', 720) })
  expect(spoken).toEqual([])
})
