import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SessionView } from '../api/types'
import { ActivityPanel } from './ActivityPanel'

const event = (id: number, at: string, team_id: string | null, actor: string, kind: string) => ({
  id,
  created_at: at,
  team_id,
  actor,
  kind,
  payload: {},
})

// Oldest first, as the API returns them.
const EVENTS = [
  event(1, '2026-10-15T10:00:00Z', null, 'facilitator', 'session_created'),
  event(2, '2026-10-15T10:05:00Z', 't-horizon', 'team', 'team_joined'),
  event(3, '2026-10-15T10:10:00Z', 't-heritage', 'team', 'investment_made'),
]

vi.mock('../api/hooks', () => ({
  useEvents: () => ({ data: EVENTS }),
  useSessionPart: () => ({ data: undefined }),
}))

const session = {
  id: 's1',
  teams: [
    { team_id: 't-horizon', team_name: 'Horizon Health' },
    { team_id: 't-heritage', team_name: 'Heritage Medicare' },
  ],
  rules: { pilot_targets: { learning: 0.7, judgment_changed: 0.6, usefulness: 0.7 } },
} as unknown as SessionView

/** The Event column's text for each body row, top to bottom. */
function eventColumn(): string[] {
  const body = screen.getAllByRole('rowgroup')[1]
  return within(body)
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[3].textContent ?? '')
}

const header = (name: string) => screen.getByRole('columnheader', { name })

describe('ActivityPanel sorting', () => {
  it('starts newest first with Time marked descending', () => {
    render(<ActivityPanel session={session} token="t" />)
    expect(eventColumn()).toEqual(['investment made', 'team joined', 'session created'])
    expect(header('Time')).toHaveAttribute('aria-sort', 'descending')
    expect(header('Team')).toHaveAttribute('aria-sort', 'none')
  })

  it('sorts a text column A to Z, then Z to A on the second click', () => {
    render(<ActivityPanel session={session} token="t" />)
    fireEvent.click(within(header('Event')).getByRole('button'))
    expect(eventColumn()).toEqual(['investment made', 'session created', 'team joined'])
    expect(header('Event')).toHaveAttribute('aria-sort', 'ascending')
    expect(header('Time')).toHaveAttribute('aria-sort', 'none')

    fireEvent.click(within(header('Event')).getByRole('button'))
    expect(eventColumn()).toEqual(['team joined', 'session created', 'investment made'])
    expect(header('Event')).toHaveAttribute('aria-sort', 'descending')
  })

  it('sorts by team name rather than team id, with events that have no team first', () => {
    render(<ActivityPanel session={session} token="t" />)
    fireEvent.click(within(header('Team')).getByRole('button'))
    // Heritage Medicare < Horizon Health; the dash for "no team" sorts before letters.
    expect(eventColumn()).toEqual(['session created', 'investment made', 'team joined'])
  })

  it('flips Time to oldest first when clicked while it is the active column', () => {
    render(<ActivityPanel session={session} token="t" />)
    fireEvent.click(within(header('Time')).getByRole('button'))
    expect(eventColumn()).toEqual(['session created', 'team joined', 'investment made'])
    expect(header('Time')).toHaveAttribute('aria-sort', 'ascending')
  })
})
