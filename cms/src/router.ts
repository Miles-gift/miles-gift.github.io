import type { ContentKind } from './types'

export type Route =
  | { name: 'overview' }
  | { name: 'list' }
  | { name: 'edit'; kind: ContentKind; id: string }

const kinds: ContentKind[] = ['articles', 'resources', 'thoughts', 'journey']

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  if (parts[0] === 'edit' && kinds.includes(parts[1] as ContentKind) && parts[2]) {
    return { name: 'edit', kind: parts[1] as ContentKind, id: parts[2] }
  }
  if (parts[0] === 'list') return { name: 'list' }
  return { name: 'overview' }
}

export function editHash(kind: ContentKind, id: string) {
  return `#/edit/${kind}/${encodeURIComponent(id)}`
}

export function navigate(hash: string) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'))
  else location.hash = hash
}
