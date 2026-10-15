import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { OpportunityMap, SessionView } from '../api/types'
import { ToastProvider } from '../components/ui/Toast'
import { OnePagerExport } from './OnePagerExport'

type Item = OpportunityMap['items'][number]

const item = (id: string, team: string, title: string): Item => ({
  id,
  team,
  title,
  participant: 'Pat',
  capability_class: 'Predictive',
  value_hypothesis: '',
  value: 5,
  readiness: { data: 4, workflow: 4, owner: 4, controls: 4 },
  readiness_avg: 4,
  dependencies: '',
  risks: '',
  owner: '',
  next_step: '',
  foundations: [],
  quadrant: 'act_now',
})

const session = {
  id: 's1',
  teams: [
    { team_id: 't1', team_name: 'Horizon Health' },
    { team_id: 't2', team_name: 'Heritage Medicare' },
    { team_id: 't3', team_name: 'CommunityCare Alliance' },
  ],
} as unknown as SessionView

const items = [
  item('a', 'Horizon Health', 'Stitch history'),
  item('b', 'Horizon Health', 'Fix the IVR'),
  item('c', 'Heritage Medicare', 'Identity resolution'),
]

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('offers only companies with shared opportunities and exports the picked ones', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(new Blob(['%PDF-1.4']), { headers: { 'content-type': 'application/pdf' } }),
    )
  vi.stubGlobal('fetch', fetch)
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
  const saved = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  render(
    <ToastProvider>
      <OnePagerExport session={session} token="ftok" items={items} />
    </ToastProvider>,
  )

  expect(screen.getByRole('button', { name: 'Horizon Health' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Heritage Medicare' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'CommunityCare Alliance' })).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Horizon Health' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Stitch history')
  expect(screen.getByRole('dialog')).not.toHaveTextContent('Identity resolution')
  fireEvent.click(screen.getByRole('checkbox', { name: /Fix the IVR/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Export PDF (1)' }))

  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
  expect(url).toContain('/api/sessions/s1/teams/t1/opportunity-onepager.pdf')
  expect(JSON.parse(String(init.body))).toEqual({ item_ids: ['a'] })
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('renders nothing when no company has shared opportunities', () => {
  render(
    <ToastProvider>
      <OnePagerExport session={session} token="ftok" items={[]} />
    </ToastProvider>,
  )
  expect(screen.queryByRole('button')).toBeNull()
})
