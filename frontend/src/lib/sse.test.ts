import { describe, expect, it } from 'vitest'
import { createSseParser, type SseEvent } from './sse'

function parse(...chunks: string[]): SseEvent[] {
  const out: SseEvent[] = []
  const p = createSseParser((e) => out.push(e))
  chunks.forEach((c) => p.push(c))
  p.end()
  return out
}

describe('createSseParser', () => {
  it('reads named events with their data', () => {
    expect(parse('event: delta\ndata: {"text":"hi"}\n\n')).toEqual([
      { event: 'delta', data: '{"text":"hi"}' },
    ])
  })

  it('reads several events from one piece, in order', () => {
    const got = parse('event: a\ndata: 1\n\nevent: b\ndata: 2\n\n')
    expect(got.map((e) => e.event)).toEqual(['a', 'b'])
  })

  it('waits for an event that is split across pieces, at any point', () => {
    const whole = 'event: delta\ndata: {"text":"split here"}\n\n'
    for (let cut = 1; cut < whole.length; cut++) {
      expect(parse(whole.slice(0, cut), whole.slice(cut))).toEqual([
        { event: 'delta', data: '{"text":"split here"}' },
      ])
    }
  })

  it('does not report an event until its blank line has arrived', () => {
    const out: SseEvent[] = []
    const p = createSseParser((e) => out.push(e))
    p.push('event: a\ndata: 1\n')
    expect(out).toEqual([])
    p.push('\n')
    expect(out).toHaveLength(1)
  })

  it('treats CRLF like LF, even when the pair is split between pieces', () => {
    expect(parse('event: a\r\ndata: 1\r\n\r\n')).toHaveLength(1)
    expect(parse('event: a\r', '\ndata: 1\r', '\n\r', '\n')).toEqual([{ event: 'a', data: '1' }])
  })

  it('joins several data lines with a newline and skips comments and blank fields', () => {
    expect(parse(': keep-alive\n\nevent: x\ndata: one\ndata: two\n\n')).toEqual([
      { event: 'x', data: 'one\ntwo' },
    ])
  })

  it('calls an event without a name "message", and ignores one without data', () => {
    expect(parse('data: plain\n\n')).toEqual([{ event: 'message', data: 'plain' }])
    expect(parse('event: lonely\n\n')).toEqual([])
  })

  it('removes only one space after the colon', () => {
    expect(parse('data:  two spaces\n\n')[0].data).toBe(' two spaces')
    expect(parse('data:none\n\n')[0].data).toBe('none')
  })

  it('reports a final event that the stream ended without terminating', () => {
    expect(parse('event: done\ndata: {}')).toEqual([{ event: 'done', data: '{}' }])
  })
})
