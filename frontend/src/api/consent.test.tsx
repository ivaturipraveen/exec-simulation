import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isShared } from '../lib/consent'
import { keys, useOpportunityConsent } from './hooks'
import type { TeamView } from './types'

const requestMock = vi.fn()
vi.mock('./client', () => ({ request: (...a: unknown[]) => requestMock(...a) }))

const seed = (granted: boolean) =>
  ({
    workspace: {
      consents: { 'sai teja': { granted, at: 't0', participant: 'Sai Teja' } },
    },
  }) as unknown as TeamView

const shared = (qc: QueryClient) =>
  isShared(qc.getQueryData<TeamView>(keys.team)!.workspace, 'Sai Teja')

function setup(initial: TeamView) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(keys.team, initial)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, ...renderHook(() => useOpportunityConsent(), { wrapper }) }
}

const body = (granted: boolean) => ({ granted, participant: 'Sai Teja', at: 't1' })

beforeEach(() => {
  requestMock.mockReset()
})

describe('useOpportunityConsent', () => {
  it('shows the new choice before the server has answered', async () => {
    let finish!: (v: unknown) => void
    requestMock.mockReturnValue(new Promise((r) => (finish = r)))
    const { qc, result } = setup(seed(false))
    act(() => result.current.mutate(body(true)))
    await waitFor(() => expect(shared(qc)).toBe(true)) // while the request is still open
    expect(result.current.isPending).toBe(true)
    await act(async () => finish({}))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('is not flipped back by an older refetch that finishes after the choice', async () => {
    let finish!: (v: unknown) => void
    requestMock.mockReturnValue(new Promise((r) => (finish = r)))
    const { qc, result } = setup(seed(false))
    // a refetch that started before the click and will answer with the OLD state, late
    let staleDone!: (v: TeamView) => void
    const stale = qc.fetchQuery({
      queryKey: keys.team,
      queryFn: () => new Promise<TeamView>((r) => (staleDone = r)),
      staleTime: 0,
    })
    stale.catch(() => {})
    act(() => result.current.mutate(body(true)))
    await waitFor(() => expect(shared(qc)).toBe(true))
    await act(async () => staleDone(seed(false))) // the old answer arrives now
    expect(shared(qc)).toBe(true) // and is ignored
    await act(async () => finish({}))
  })

  it('puts the old state back when the save fails', async () => {
    requestMock.mockImplementation(() => Promise.reject(new Error('nope')))
    const { qc, result } = setup(seed(false))
    await act(async () => {
      result.current.mutate(body(true))
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(shared(qc)).toBe(false)
  })

  it('refetches the team view when it settles, so the server has the last word', async () => {
    requestMock.mockResolvedValue({})
    const { qc, result } = setup(seed(false))
    const spy = vi.spyOn(qc, 'invalidateQueries')
    act(() => result.current.mutate(body(true)))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledWith({ queryKey: keys.team })
  })
})
