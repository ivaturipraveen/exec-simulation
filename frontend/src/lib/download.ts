import { request } from '../api/client'

export async function downloadText(path: string, token: string, filename: string, type: string) {
  const text = await request<string>('GET', path, { token, raw: true })
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
