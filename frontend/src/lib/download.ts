import { request } from '../api/client'

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadText(path: string, token: string, filename: string, type: string) {
  const text = await request<string>('GET', path, { token, raw: true })
  save(new Blob([text], { type }), filename)
}

/** A generated file (e.g. a PDF) from a POST endpoint that takes a JSON body. */
export async function downloadPosted(path: string, token: string, body: unknown, filename: string) {
  save(await request<Blob>('POST', path, { token, body, blob: true }), filename)
}
