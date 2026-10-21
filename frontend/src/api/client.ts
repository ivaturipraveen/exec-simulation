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

/** The error for a request that never got an answer (offline, wrong address, blocked by CORS). */
export function networkError(): ApiError {
  return new ApiError(
    0,
    'network_error',
    API_ORIGIN
      ? `Cannot reach the API at ${API_ORIGIN}. Check your connection, that the API is running, and that its CORS_ORIGINS includes this site.`
      : 'Cannot reach the server. Check your connection.',
  )
}

/**
 * A static host answering /api with its own index.html means the UI was built without VITE_API_URL
 * (or the API is down): say so instead of failing on the HTML. Returns null for a normal answer.
 */
export function unreachableError(response: Response): ApiError | null {
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return null
  return new ApiError(
    response.status || 0,
    'api_unreachable',
    API_ORIGIN
      ? `The API at ${API_ORIGIN} did not answer correctly. Check that the API service is running.`
      : 'This page cannot reach the API. When the UI is hosted separately, build it with VITE_API_URL set to the API address.',
  )
}

/** The error for a failed (non-2xx) response, using the server's error envelope when it sent one. */
export async function errorFromResponse(response: Response): Promise<ApiError> {
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
  return new ApiError(response.status, code, message, details)
}

export async function request<T>(
  method: Method,
  path: string,
  options: { token?: string | null; body?: unknown; raw?: boolean; blob?: boolean } = {},
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
    throw networkError()
  }
  const textual = !options.raw && !options.blob
  if (textual) {
    const unreachable = unreachableError(response)
    if (unreachable) throw unreachable
  }
  if (!response.ok) throw await errorFromResponse(response)
  if (response.status === 204) return undefined as T
  if (options.blob) return (await response.blob()) as T
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
