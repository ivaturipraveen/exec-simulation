import { useQuery } from '@tanstack/react-query'
import { signIn } from '../lib/storage'
import { request } from './client'

export interface AuthStatus {
  required: boolean
  signed_in: boolean
  email?: string | null
  /** Facilitator account or a team account (null while signed out or when sign-in is off). */
  role?: 'facilitator' | 'team' | null
  payer_id?: string | null
  payer_name?: string | null
}

export const authStatusKey = ['auth-status'] as const

/** Whether the server requires sign-in and whether this browser is signed in. */
export function useAuthStatus() {
  return useQuery({
    queryKey: authStatusKey,
    queryFn: () => request<AuthStatus>('GET', '/auth/status', { token: signIn.get() }),
    staleTime: 5 * 60_000,
  })
}
