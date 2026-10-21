import { API_ORIGIN } from '../lib/apiOrigin'
import { createSseParser } from '../lib/sse'
import { ApiError, errorFromResponse, networkError, unreachableError } from './client'
import type { AnalystAnswer, AnalystMode, AnalystSource } from './types'

export interface AnalystQuestion {
  question: string
  mode: AnalystMode
  context?: string
}

export interface AnalystStreamHandlers {
  /** The passages found in the data room, known before the model starts writing. */
  onMeta?: (meta: { sources: AnalystSource[]; generative: boolean }) => void
  /** A piece of the answer, in order. */
  onDelta: (text: string) => void
}

/** What the server sends, one JSON object per event (see `/api/team/ai/ask/stream`). */
type StreamEvent =
  | { type: 'meta'; sources: AnalystSource[]; generative: boolean }
  | { type: 'delta'; text: string }
  | { type: 'done'; answer: AnalystAnswer }
  | { type: 'error'; message: string }

/**
 * Asks the analyst and reports the answer as it is written. Resolves with the final answer, which
 * is authoritative: it can differ from the pieces already shown (a refusal, a cut-off answer).
 * Rejects with an `ApiError` for a refused request (not signed in, rate limited), for a failure
 * while the answer was being written, and when the connection drops before it finishes.
 */
export async function streamAnalyst(
  question: AnalystQuestion,
  token: string | null,
  handlers: AnalystStreamHandlers,
  signal?: AbortSignal,
): Promise<AnalystAnswer> {
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_ORIGIN}/api/team/ai/ask/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(question),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw networkError()
  }
  const unreachable = unreachableError(response)
  if (unreachable) throw unreachable
  if (!response.ok) throw await errorFromResponse(response)
  if (!response.body) {
    throw new ApiError(
      0,
      'stream_unsupported',
      'This browser cannot show the answer as it is written',
    )
  }

  let final: AnalystAnswer | null = null
  let failure: ApiError | null = null
  const parser = createSseParser(({ data }) => {
    let event: StreamEvent
    try {
      event = JSON.parse(data) as StreamEvent
    } catch {
      return // a malformed event is skipped rather than ending the answer
    }
    if (event.type === 'meta')
      handlers.onMeta?.({ sources: event.sources, generative: event.generative })
    else if (event.type === 'delta') handlers.onDelta(event.text)
    else if (event.type === 'done') final = event.answer
    else if (event.type === 'error')
      failure = new ApiError(502, 'analyst_stream_error', event.message)
  })

  const reader = response.body.getReader()
  // `stream: true` keeps a character that is split between two network pieces (an em dash, an emoji)
  const decoder = new TextDecoder()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parser.push(decoder.decode(value, { stream: true }))
      if (failure) break
    }
    parser.push(decoder.decode())
    parser.end()
  } catch (err) {
    if (signal?.aborted) throw err
    throw new ApiError(0, 'stream_interrupted', 'The connection dropped before the answer finished')
  } finally {
    reader.cancel().catch(() => undefined)
  }

  if (failure) throw failure
  if (!final) {
    throw new ApiError(0, 'stream_interrupted', 'The connection dropped before the answer finished')
  }
  return final
}
