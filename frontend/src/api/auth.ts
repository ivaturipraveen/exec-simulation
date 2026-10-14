import { useQuery } from '@tanstack/react-query'
import { auth, signIn } from '../lib/storage'
import { request } from './client'
import type { JoinResult } from './types'

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

/** Join a team by its code and remember the team on this device. A signed-in team account must
 *  use its own team's code (the server refuses another team's). */
export async function joinTeam(code: string): Promise<JoinResult> {
  const r = await request<JoinResult>('POST', '/join', {
    token: signIn.get(),
    body: { code: code.trim() },
  })
  auth.setTeam({
    token: r.token,
    teamId: r.team_id,
    sessionId: r.session_id,
    teamName: r.team_name,
    payerName: r.payer_name,
  })
  return r
}
