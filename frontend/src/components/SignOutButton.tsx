import { useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { authStatusKey, useAuthStatus } from '../api/auth'
import { signIn } from '../lib/storage'

/** Signs this browser out of its account (shown only when the server uses sign-in). */
export function SignOutButton() {
  const { data } = useAuthStatus()
  const queryClient = useQueryClient()
  if (!data?.required) return null
  return (
    <button
      className="btn btn--ghost btn--sm btn--icon"
      type="button"
      onClick={() => {
        signIn.clear()
        queryClient.setQueryData(authStatusKey, { required: true, signed_in: false, email: null })
      }}
      aria-label="Sign out"
      title={data.email ? `Sign out ${data.email}` : 'Sign out'}
    >
      <LogOut aria-hidden />
    </button>
  )
}
