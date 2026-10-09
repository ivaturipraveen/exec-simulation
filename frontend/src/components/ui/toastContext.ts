import { createContext, useContext } from 'react'

export const ToastContext = createContext<(message: string, tone?: 'info' | 'error') => void>(
  () => {},
)

export const useToast = () => useContext(ToastContext)
