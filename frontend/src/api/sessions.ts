import { useQuery } from '@tanstack/react-query'
import { signIn } from '../lib/storage'
import { request } from './client'
import type { SessionRow } from './types'

export const sessionsKey = ['admin-sessions'] as const

/** Every session on the server (admin). An error means this browser may not manage sessions. */
export function useSessions() {
  return useQuery({
    queryKey: sessionsKey,
    queryFn: () => request<SessionRow[]>('GET', '/admin/sessions', { token: signIn.get() }),
    retry: false,
    staleTime: 30_000,
  })
}
