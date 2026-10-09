import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

/** Subscribes to session invalidation hints and refetches affected queries. */
export function useRealtime(sessionId: string | undefined, token: string | null, teamId?: string) {
  const qc = useQueryClient()
  const [connected, setConnected] = useState(false)
  const retry = useRef(0)

  useEffect(() => {
    if (!sessionId || !token) return
    let ws: WebSocket | null = null
    let ping: number | undefined
    let timer: number | undefined
    let closed = false

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${window.location.host}/ws/sessions/${sessionId}`)
      ws.onopen = () => {
        ws?.send(JSON.stringify({ token })) // authenticate in-band; never put tokens in URLs
        retry.current = 0
        setConnected(true)
        ping = window.setInterval(
          () => ws?.readyState === WebSocket.OPEN && ws.send('ping'),
          25_000,
        )
      }
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; scopes: string[] }
          if (msg.type !== 'invalidate') return
          qc.invalidateQueries({ queryKey: ['session', sessionId] })
          const touchesTeam = msg.scopes.some(
            (s) => s === 'team:*' || (teamId && s === `team:${teamId}`),
          )
          if (touchesTeam || msg.scopes.includes('session'))
            qc.invalidateQueries({ queryKey: ['team'] })
        } catch {
          /* ignore malformed */
        }
      }
      ws.onclose = () => {
        setConnected(false)
        window.clearInterval(ping)
        if (closed) return
        const delay = Math.min(15_000, 1000 * 2 ** retry.current++)
        timer = window.setTimeout(connect, delay)
      }
    }
    connect()
    return () => {
      closed = true
      window.clearInterval(ping)
      window.clearTimeout(timer)
      ws?.close()
    }
  }, [sessionId, token, teamId, qc])

  return connected
}
