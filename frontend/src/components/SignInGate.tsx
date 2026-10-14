import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStatus } from '../api/auth'
import { signIn } from '../lib/storage'
import { Loading } from './ui/primitives'

/**
 * Sends visitors to the sign-in page until they sign in (when the server requires it).
 * `facilitatorOnly` pages send team accounts back to the start page.
 */
export function SignInGate({
  children,
  facilitatorOnly = false,
}: {
  children: ReactNode
  facilitatorOnly?: boolean
}) {
  const { data, isPending } = useAuthStatus()
  const location = useLocation()
  if (isPending) return <Loading />
  // If the API cannot be reached, the pages below show that error themselves.
  if (data && data.required && !data.signed_in) {
    signIn.clear()
    const next = location.pathname + location.search
    return (
      <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />
    )
  }
  if (facilitatorOnly && data?.role === 'team') return <Navigate to="/" replace />
  return <>{children}</>
}
