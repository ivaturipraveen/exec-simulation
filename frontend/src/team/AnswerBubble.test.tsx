import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalystAnswer } from '../api/types'
import { AnswerBubble, type AnswerTurn } from './AnswerBubble'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q }))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

const answer = (text: string): AnalystAnswer => ({
  answer: text,
  mode: 'ask',
  generative: true,
  model: 'm',
  citations: ['H-01'],
  sources: [
    { artifact_id: 'H-01', title: 'Complaint log', domain: 'quality', snippet: '', score: 1 },
    { artifact_id: 'H-02', title: 'Survey results', domain: 'quality', snippet: '', score: 0.5 },
    { artifact_id: 'H-01', title: 'Complaint log', domain: 'quality', snippet: '', score: 0.4 },
  ],
})

const show = (turn: AnswerTurn, onOpenSource = vi.fn(), onGrow = vi.fn()) => {
  render(<AnswerBubble turn={turn} onOpenSource={onOpenSource} onGrow={onGrow} />)
  return { onOpenSource, onGrow }
}

describe('AnswerBubble', () => {
  it('shows a waiting indicator until the first words arrive', () => {
    show({ fresh: true })
    expect(screen.getByText(/Analyzing your data room/)).toBeInTheDocument()
  })

  it('types the answer out, without the waiting indicator once words appear', () => {
    show({
      fresh: true,
      partial: 'Complaints rose after the outreach change in March, mostly in new counties.',
    })
    wait(150)
    expect(screen.queryByText(/Analyzing your data room/)).toBeNull()
    const shown = document.querySelector('.analyst__bubble--ai .md')!.textContent!
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThan(40)
    expect(document.querySelector('.analyst__bubble')).toHaveClass('is-typing')
  })

  it('adds the sources once the answer is complete, one chip for each source', () => {
    const text = 'Complaints rose [H-01].'
    show({ fresh: true, answer: answer(text) })
    expect(screen.queryByRole('button', { name: /Complaint log/ })).toBeNull() // still typing
    wait(5000)
    expect(document.querySelector('.analyst__bubble')).not.toHaveClass('is-typing')
    expect(screen.getAllByRole('button', { name: /Complaint log/ })).toHaveLength(1) // de-duplicated
    expect(screen.getByRole('button', { name: /Survey results/ })).toBeInTheDocument()
  })

  it('marks the sources the answer cites', () => {
    show({ answer: answer('Complaints rose [H-01].') })
    expect(screen.getByRole('button', { name: /Complaint log/ })).toHaveClass('badge--accent')
    expect(screen.getByRole('button', { name: /Survey results/ })).not.toHaveClass('badge--accent')
  })

  it('opens a source when its chip is clicked', () => {
    const { onOpenSource } = show({ answer: answer('Complaints rose [H-01].') })
    fireEvent.click(screen.getByRole('button', { name: /Survey results/ }))
    expect(onOpenSource).toHaveBeenCalledWith('H-02')
  })

  it('shows an answer from history all at once, with its sources', () => {
    show({ answer: answer('An answer from an earlier visit.') }) // not "fresh"
    expect(screen.getByText('An answer from an earlier visit.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Complaint log/ })).toBeInTheDocument()
    expect(document.querySelector('.analyst__bubble')).not.toHaveClass('is-typing')
  })

  it('shows everything at once for people who prefer reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q }))
    show({ fresh: true, answer: answer('Shown in full straight away.') })
    expect(screen.getByText('Shown in full straight away.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Complaint log/ })).toBeInTheDocument()
  })

  it('shows an error under whatever was written before it failed', () => {
    show({ fresh: true, partial: 'Complaints ro', error: 'The analyst is temporarily unavailable' })
    wait(2000)
    expect(screen.getByText('The analyst is temporarily unavailable')).toBeInTheDocument()
    expect(screen.queryByText(/Analyzing your data room/)).toBeNull()
  })

  it('tells the thread when it grows, so the thread can stay scrolled to the end', () => {
    const { onGrow } = show({ fresh: true, partial: 'Complaints rose after the outreach change.' })
    const initial = onGrow.mock.calls.length
    wait(300)
    expect(onGrow.mock.calls.length).toBeGreaterThan(initial)
  })
})
