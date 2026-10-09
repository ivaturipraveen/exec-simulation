import { API_ORIGIN } from '../lib/apiOrigin'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** Human-readable message including validation details when present. */
  get detailText(): string {
    if (Array.isArray(this.details) && this.details.length) {
      return this.details
        .map((d) => (typeof d === 'string' ? d : ((d as { message?: string }).message ?? '')))
        .filter(Boolean)
        .join(' · ')
    }
    return ''
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

export async function request<T>(
  method: Method,
  path: string,
  options: { token?: string | null; body?: unknown; raw?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  let response: Response
  try {
    response = await fetch(`${API_ORIGIN}/api${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'network_error', 'Cannot reach the server. Check your connection.')
  }
  if (!response.ok) {
    let code = 'http_error'
    let message = `Request failed (${response.status})`
    let details: unknown
    try {
      const body = (await response.json()) as {
        error?: { code: string; message: string; details?: unknown }
      }
      if (body.error) ({ code, message, details } = body.error)
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(response.status, code, message, details)
  }
  if (response.status === 204) return undefined as T
  if (options.raw) return (await response.text()) as T
  return (await response.json()) as T
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const extra = err.detailText
    return extra ? `${err.message}: ${extra}` : err.message
  }
  return err instanceof Error ? err.message : 'Something went wrong'
}
