export interface SseEvent {
  /** The `event:` name; "message" when the server did not give one. */
  event: string
  /** The `data:` lines joined with a newline. */
  data: string
}

/**
 * Reads a server-sent event stream a piece at a time. Network pieces can end anywhere, in the middle
 * of a line or even between a "\r" and its "\n", so the parser keeps what it has not finished and
 * only reports an event once its blank-line terminator has arrived.
 */
export function createSseParser(onEvent: (e: SseEvent) => void) {
  let buffer = ''

  const dispatch = (block: string) => {
    let event = 'message'
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (line === '' || line.startsWith(':')) continue // blank or a comment
      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      let value = colon === -1 ? '' : line.slice(colon + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'event') event = value
      else if (field === 'data') data.push(value)
    }
    if (data.length) onEvent({ event, data: data.join('\n') })
  }

  return {
    push(chunk: string) {
      buffer += chunk
      // A "\r" at the very end may be the first half of "\r\n": wait for the next piece.
      const held = buffer.endsWith('\r') ? '\r' : ''
      const text = (held ? buffer.slice(0, -1) : buffer).replace(/\r\n?/g, '\n')
      const blocks = text.split('\n\n')
      buffer = (blocks.pop() ?? '') + held
      blocks.forEach(dispatch)
    },
    /** The stream has ended: report a last event that was not followed by a blank line. */
    end() {
      const rest = buffer.replace(/\r\n?/g, '\n')
      buffer = ''
      if (rest.trim()) dispatch(rest)
    },
  }
}
