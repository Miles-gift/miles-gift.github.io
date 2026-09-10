export type ContentKind = 'articles' | 'resources' | 'thoughts' | 'journey'

export type ContentData = Record<string, unknown> & {
  title: string
  pubDate: string
  draft: boolean
  visibility: 'public' | 'unlisted' | 'draft'
}

export interface ContentSummary {
  kind: ContentKind
  kindLabel: string
  id: string
  title: string
  description: string
  pubDate: string
  topic: string
  draft: boolean
  visibility: string
  featured: boolean
  file: string
  version: string
}

export interface ContentDetail {
  kind: ContentKind
  kindLabel: string
  id: string
  file: string
  version: string
  data: ContentData
  body: string
  warnings?: ValidationIssue[]
}

export interface ValidationIssue {
  field: string
  message: string
}

export interface PreflightResult {
  ok: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  data?: ContentData
}

export interface MetaInfo {
  kinds: { value: ContentKind; label: string }[]
  taxonomy: {
    topics: string[]
    resourceTypes: string[]
    resourceStatuses: string[]
    journeyKinds: string[]
    visibilities: string[]
    licenses: string[]
  }
  localOnly: boolean
  trashRoot: string
}

export interface Stats {
  total: number
  published: number
  drafts: number
  counts: Record<ContentKind, number>
  words: { cjk: number; latin: number; total: number }
  recent: ContentSummary[]
}

export interface UploadResult {
  name: string
  url: string
  bytes: number
  width: number
  height: number
  format: 'webp'
}
