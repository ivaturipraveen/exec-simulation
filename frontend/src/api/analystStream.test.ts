import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { streamAnalyst } from './analystStream'
import { ApiError } from './client'
import type { AnalystAnswer } from './types'

const answer = (text: string): AnalystAnswer => ({
  answer: text,
  mode: 'ask',
  sources: [],
  citations: [],
  generative: true,
  model: 'm',
})

const sse = (event: object) =>
  `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`

/** A response whose body arrives in the given pieces (strings, or bytes to cut a character in half). */
function streamed(pieces: (string | Uint8Array)[], init: ResponseInit = {}): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of pieces) controller.enqueue(typeof p === 'string' ? encoder.encode(p) : p)
      controller.close()
    },
  })
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    ...init,
  })
}

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const ask = (handlers = { onDelta: vi.fn(), onMeta: vi.fn() }, signal?: AbortSignal) =>
  streamAnalyst({ question: 'Why?', mode: 'ask' }, 'tok', handlers, signal)

describe('streamAnalyst', () => {
  it('reports the sources, then each piece in order, and resolves with the final answer', async () => {
    const final = answer('Complaints rose [H-01].')
    fetchMock.mockResolvedValue(
      streamed([
        sse({ type: 'meta', sources: [], generative: true }),
        sse({ type: 'delta', text: 'Complaints ' }),
        sse({ type: 'delta', text: 'rose [H-01].' }),
        sse({ type: 'done', answer: final }),
      ]),
    )
    const calls: string[] = []
    const result = await streamAnalyst({ question: 'Why?', mode: 'ask' }, 'tok', {
      onMeta: (m) => calls.push(`meta:${m.generative}`),
      onDelta: (t) => calls.push(`delta:${t}`),
    })
    expect(calls).toEqual(['meta:true', 'delta:Complaints ', 'delta:rose [H-01].'])
    expect(result).toEqual(final)
  })

  it('sends the question with the team token to the streaming endpoint', async () => {
    fetchMock.mockResolvedValue(streamed([sse({ type: 'done', answer: answer('x') })]))
    await ask()
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/team\/ai\/ask\/stream$/)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(init.headers.Accept).toBe('text/event-stream')
    expect(JSON.parse(init.body)).toEqual({ question: 'Why?', mode: 'ask' })
  })

  it('puts together events that arrive split across network pieces', async () => {
    const whole = [
      sse({ type: 'delta', text: 'one ' }),
      sse({ type: 'delta', text: 'two' }),
      sse({ type: 'done', answer: answer('one two') }),
    ].join('')
    const pieces = whole.match(/[\s\S]{1,7}/g)! // seven characters at a time, cutting events anywhere
    fetchMock.mockResolvedValue(streamed(pieces))
    const seen: string[] = []
    const result = await streamAnalyst({ question: 'Why?', mode: 'ask' }, 'tok', {
      onDelta: (t) => seen.push(t),
    })
    expect(seen.join('')).toBe('one two')
    expect(result.answer).toBe('one two')
  })

  it('keeps a character that is cut in half between two pieces (an em dash)', async () => {
    const bytes = new TextEncoder().encode(sse({ type: 'delta', text: 'a — b' }))
    const dash = bytes.indexOf(0xe2) // the first of the dash's three bytes
    const done = new TextEncoder().encode(sse({ type: 'done', answer: answer('a — b') }))
    fetchMock.mockResolvedValue(
      streamed([
        bytes.slice(0, dash + 1),
        bytes.slice(dash + 1, dash + 2),
        bytes.slice(dash + 2),
        done,
      ]),
    )
    const seen: string[] = []
    await streamAnalyst({ question: 'Why?', mode: 'ask' }, 'tok', { onDelta: (t) => seen.push(t) })
    expect(seen).toEqual(['a — b'])
  })

  it('rejects with the server message when the answer fails part-way', async () => {
    fetchMock.mockResolvedValue(
      streamed([
        sse({ type: 'delta', text: 'Partial' }),
        sse({ type: 'error', message: 'The analyst is temporarily unavailable' }),
      ]),
    )
    const onDelta = vi.fn()
    await expect(ask({ onDelta, onMeta: vi.fn() })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'analyst_stream_error',
      message: 'The analyst is temporarily unavailable',
    })
    expect(onDelta).toHaveBeenCalledWith('Partial') // what arrived before is still reported
  })

  it('rejects when the stream ends without a final answer', async () => {
    fetchMock.mockResolvedValue(streamed([sse({ type: 'delta', text: 'cut off' })]))
    await expect(ask()).rejects.toMatchObject({ code: 'stream_interrupted' })
  })

  it('rejects when the connection breaks while reading', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(sse({ type: 'delta', text: 'x' })))
        c.error(new Error('reset'))
      },
    })
    fetchMock.mockResolvedValue(new Response(body, { status: 200 }))
    await expect(ask()).rejects.toMatchObject({ code: 'stream_interrupted' })
  })

  it('turns a refused request into an ordinary error, before any stream starts', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'rate_limited', message: 'The analyst is busy' } }),
        {
          status: 429,
          headers: { 'content-type': 'application/json' },
        },
      ),
    )
    const err = await ask().catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 429, code: 'rate_limited', message: 'The analyst is busy' })
  })

  it('says so when the host answers with a web page instead of the API', async () => {
    fetchMock.mockResolvedValue(
      new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    )
    await expect(ask()).rejects.toMatchObject({ code: 'api_unreachable' })
  })

  it('reports a network failure as a readable error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(ask()).rejects.toMatchObject({ code: 'network_error' })
  })

  it('lets a cancelled request through as the cancellation, not as a network error', async () => {
    const controller = new AbortController()
    controller.abort()
    fetchMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'))
    await expect(ask(undefined, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('skips a garbled event instead of giving up on the answer', async () => {
    fetchMock.mockResolvedValue(
      streamed([
        'event: delta\ndata: {not json\n\n',
        sse({ type: 'delta', text: 'ok' }),
        sse({ type: 'done', answer: answer('ok') }),
      ]),
    )
    const seen: string[] = []
    const result = await streamAnalyst({ question: 'Why?', mode: 'ask' }, 'tok', {
      onDelta: (t) => seen.push(t),
    })
    expect(seen).toEqual(['ok'])
    expect(result.answer).toBe('ok')
  })
})
