import { createContext, useContext } from 'react'
import type { AnalystMode } from '../api/types'

export interface AnalystPreset {
  mode?: AnalystMode
  /** Extra context sent with the next question, e.g. a results summary. */
  context?: string
}

export const AnalystContext = createContext<{ openAnalyst: (preset?: AnalystPreset) => void }>({
  openAnalyst: () => {},
})

/** Open the AI analyst panel from any team page, optionally in a given mode with context. */
export function useAnalyst() {
  return useContext(AnalystContext)
}
