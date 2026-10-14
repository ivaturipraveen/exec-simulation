import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'info' | 'warning' | 'error'

/** A question the user must answer; resolves true on confirm, false on cancel/Escape. */
export interface ConfirmOptions {
  title: string
  message?: string
  tone?: 'info' | 'warning' | 'danger'
  confirmLabel?: string
  cancelLabel?: string
}

export const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {})

export const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(
  async () => false,
)

/** Short notifications that dismiss themselves: `toast('Saved')`, `toast(msg, 'error')`. */
export const useToast = () => useContext(ToastContext)

/** Ask before an action, in the app instead of the browser's confirm(): `if (await confirm({...}))`. */
export const useConfirm = () => useContext(ConfirmContext)
