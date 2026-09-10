import type {
  ContentData,
  ContentDetail,
  ContentKind,
  ContentSummary,
  MetaInfo,
  PreflightResult,
  Stats,
  UploadResult,
} from './types'

export class ApiError extends Error {
  status: number
  payload: Record<string, unknown>

  constructor(message: string, status: number, payload: Record<string, unknown>) {
    super(message)
    this.status = status
    this.payload = payload
  }
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
  })
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok) throw new ApiError(String(data.error || `请求失败 (${res.status})`), res.status, data)
  return data as T
}

export const api = {
  list(params: { q?: string; kind?: string; status?: string } = {}) {
    const sp = new URLSearchParams()
    if (params.q) sp.set('q', params.q)
    if (params.kind) sp.set('kind', params.kind)
    if (params.status) sp.set('status', params.status)
    return req<{ items: ContentSummary[] }>(`/api/content?${sp.toString()}`)
  },

  get(kind: ContentKind, id: string) {
    return req<ContentDetail>(`/api/content/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`)
  },

  create(body: { kind: ContentKind; id: string }) {
    return req<ContentDetail>('/api/content', { method: 'POST', body: JSON.stringify(body) })
  },

  save(detail: ContentDetail, data: ContentData, body: string) {
    return req<ContentDetail>(`/api/content/${detail.kind}/${encodeURIComponent(detail.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ version: detail.version, data, body }),
    })
  },

  remove(kind: ContentKind, id: string) {
    return req<{ ok: boolean; recoverableAt: string; mediaRecoverableAt?: string }>(`/api/content/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  preflight(detail: ContentDetail, data: ContentData, body: string) {
    return req<PreflightResult>(`/api/content/${detail.kind}/${encodeURIComponent(detail.id)}/preflight`, {
      method: 'POST',
      body: JSON.stringify({ data, body }),
    })
  },

  async preview(detail: ContentDetail, data: ContentData, body: string) {
    const res = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: detail.kind, id: detail.id, data, body, base: '' }),
    })
    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as Record<string, unknown>
      throw new ApiError(String(payload.error || '预览失败'), res.status, payload)
    }
    return res.text()
  },

  upload(file: File, kind: ContentKind, id: string) {
    const form = new FormData()
    form.append('file', file)
    form.append('kind', kind)
    form.append('id', id)
    return req<UploadResult>('/api/upload', { method: 'POST', body: form })
  },

  meta() {
    return req<MetaInfo>('/api/meta')
  },

  stats() {
    return req<Stats>('/api/stats')
  },
}
