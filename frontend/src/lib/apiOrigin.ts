/**
 * Where the API lives. Empty (the default) means the same host as the page: the Vite dev proxy
 * locally, or the API serving the built UI (`make start`). Set `VITE_API_URL` at build time when
 * the UI is hosted separately, e.g. https://exec-sim-api.onrender.com.
 */
export const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')

/** WebSocket base: same host as the page, or the API origin with ws(s) in place of http(s). */
export function wsOrigin(): string {
  if (API_ORIGIN) return API_ORIGIN.replace(/^http/, 'ws')
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}`
}
