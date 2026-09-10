// yoyo Studio 内容工作台的统一读写与校验层。
// 只管理 src/content 中已上线的四类内容；不接触本地私人素材目录。
import matter from 'gray-matter'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url))
export const CONTENT_ROOT = join(PROJECT_ROOT, 'src', 'content')
export const MEDIA_ROOT = join(PROJECT_ROOT, 'public', 'media')
export const TRASH_ROOT = join(PROJECT_ROOT, '.trash', 'cms')

export const KINDS = ['articles', 'resources', 'thoughts', 'journey']
export const KIND_LABELS = {
  articles: '长篇札记',
  resources: '原文资料',
  thoughts: '灵光便笺',
  journey: '旅程',
}

const taxonomy = JSON.parse(await readFile(join(CONTENT_ROOT, 'taxonomy.json'), 'utf8'))
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const THOUGHT_RE = /^\d{8}-\d{3}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}(?:T.*)?$/
const TIMELINE_RE = /^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/
const URL_RE = /^https?:\/\/[^\s]+$/i

export function safeRel(value) {
  if (!value || typeof value !== 'string') return null
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!normalized || normalized.includes('..') || normalized.includes('\0')) return null
  return normalized
}

export function assertKind(kind) {
  return KINDS.includes(kind) ? kind : null
}

export function dateStr(value) {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function itemPath(kind, id) {
  if (kind === 'articles') return join(CONTENT_ROOT, kind, id, 'zh-cn.md')
  return join(CONTENT_ROOT, kind, `${id}.md`)
}

function relativeItemPath(kind, id) {
  return relative(PROJECT_ROOT, itemPath(kind, id)).replace(/\\/g, '/')
}

function versionOf(raw) {
  return createHash('sha256').update(raw).digest('hex').slice(0, 20)
}

async function writeTextAtomic(file, source) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, source, 'utf8')
  try {
    await rename(temp, file)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
  return []
}

function normalizeOptional(value) {
  const text = String(value ?? '').trim()
  return text || undefined
}

function normalizeBase(data) {
  return {
    ...data,
    title: String(data?.title ?? '').trim(),
    description: String(data?.description ?? data?.summary ?? '').trim(),
    pubDate: dateStr(data?.pubDate),
    topic: String(data?.topic ?? '').trim(),
    tags: normalizeArray(data?.tags),
    draft: Boolean(data?.draft),
    visibility: String(data?.visibility || (data?.draft ? 'draft' : 'public')),
  }
}

export function normalizeData(kind, input, id) {
  const data = normalizeBase(input || {})
  if (kind === 'articles') {
    return {
      title: data.title,
      slug: id,
      description: data.description,
      pubDate: data.pubDate,
      ...(normalizeOptional(input.updatedDate) ? { updatedDate: dateStr(input.updatedDate) } : {}),
      draft: data.draft,
      visibility: data.visibility,
      kind: 'article',
      maintenance: String(input.maintenance || 'active'),
      topic: data.topic,
      tags: data.tags,
      ...(normalizeOptional(input.series) ? { series: normalizeOptional(input.series) } : {}),
      ...(input.seriesOrder === '' || input.seriesOrder == null ? {} : { seriesOrder: Number(input.seriesOrder) }),
      cover: String(input.cover ?? ''),
      coverAlt: String(input.coverAlt ?? '').trim(),
      featured: Boolean(input.featured),
      pinTop: Number(input.pinTop) || 0,
      lang: 'zh-cn',
      canonical: String(input.canonical ?? '').trim(),
      license: String(input.license || 'CC-BY-NC-SA-4.0'),
    }
  }
  if (kind === 'resources') {
    const rating = input.rating === '' || input.rating == null ? null : Number(input.rating)
    return {
      title: data.title,
      slug: id,
      description: data.description,
      pubDate: data.pubDate,
      resourceType: String(input.resourceType || 'note'),
      topic: data.topic,
      tags: data.tags,
      sourceKind: String(input.sourceKind || 'personal-note'),
      sourceUrl: String(input.sourceUrl ?? '').trim(),
      ...(normalizeOptional(input.author) ? { author: normalizeOptional(input.author) } : {}),
      ...(normalizeOptional(input.publisher) ? { publisher: normalizeOptional(input.publisher) } : {}),
      ...(input.publishedYear === '' || input.publishedYear == null ? {} : { publishedYear: Number(input.publishedYear) }),
      language: String(input.language || 'zh-cn'),
      status: String(input.status || 'inbox'),
      progress: Number(input.progress) || 0,
      rating,
      ...(normalizeOptional(input.startedAt) ? { startedAt: dateStr(input.startedAt) } : {}),
      ...(normalizeOptional(input.completedAt) ? { completedAt: dateStr(input.completedAt) } : {}),
      lastReviewedAt: dateStr(input.lastReviewedAt),
      cover: String(input.cover ?? ''),
      coverAlt: String(input.coverAlt ?? '').trim(),
      takeaways: normalizeArray(input.takeaways),
      draft: data.draft,
      visibility: data.visibility,
    }
  }
  if (kind === 'thoughts') {
    return {
      id,
      title: data.title,
      description: data.description,
      pubDate: data.pubDate,
      topic: data.topic,
      tags: data.tags,
      related: normalizeArray(input.related),
      draft: data.draft,
      visibility: data.visibility,
    }
  }
  return {
    title: data.title,
    slug: id,
    pubDate: data.pubDate,
    startDate: String(input.startDate ?? '').trim(),
    endDate: normalizeOptional(input.endDate) ?? null,
    dateLabel: String(input.dateLabel ?? '').trim(),
    ...(normalizeOptional(input.location) ? { location: normalizeOptional(input.location) } : {}),
    ...(normalizeOptional(input.organization) ? { organization: normalizeOptional(input.organization) } : {}),
    ...(normalizeOptional(input.role) ? { role: normalizeOptional(input.role) } : {}),
    kind: String(input.kind || 'milestone'),
    summary: String(input.summary ?? input.description ?? '').trim(),
    highlights: normalizeArray(input.highlights),
    skills: normalizeArray(input.skills),
    featured: Boolean(input.featured),
    order: Number(input.order) || 0,
    sourceLevel: String(input.sourceLevel || 'user-provided'),
    ...(normalizeOptional(input.projectTitle) ? { projectTitle: normalizeOptional(input.projectTitle) } : {}),
    draft: data.draft,
    visibility: data.visibility,
  }
}

function addIssue(list, field, message) {
  list.push({ field, message })
}

function requiredText(errors, data, field, min, max) {
  const value = String(data[field] ?? '').trim()
  if (value.length < min) addIssue(errors, field, `至少需要 ${min} 个字符`)
  if (value.length > max) addIssue(errors, field, `不能超过 ${max} 个字符`)
}

function enumValue(errors, value, allowed, field) {
  if (!allowed.includes(value)) addIssue(errors, field, `请选择：${allowed.join('、')}`)
}

export function validateContent(kind, id, rawData, body = '', { publish = false } = {}) {
  const errors = []
  const warnings = []
  if (!assertKind(kind)) addIssue(errors, 'kind', '不支持的内容类型')
  const validId = kind === 'thoughts' ? THOUGHT_RE.test(id) : SLUG_RE.test(id)
  if (!validId) addIssue(errors, 'id', kind === 'thoughts' ? '随想 ID 必须形如 YYYYMMDD-001' : '标识只能使用小写英文、数字与连字符')
  const data = normalizeData(kind, rawData, id)
  const titleMax = kind === 'thoughts' ? 60 : kind === 'articles' ? 80 : 100
  requiredText(errors, data, 'title', 2, titleMax)
  if (kind === 'journey') requiredText(errors, data, 'summary', 8, 220)
  else requiredText(errors, data, 'description', kind === 'thoughts' ? 8 : 12, 220)
  if (!DATE_RE.test(data.pubDate)) addIssue(errors, 'pubDate', '日期必须是 YYYY-MM-DD 或 ISO 日期时间')
  enumValue(errors, data.visibility, taxonomy.visibilities, 'visibility')

  if (kind !== 'journey') {
    enumValue(errors, data.topic, taxonomy.topics, 'topic')
    if (!Array.isArray(data.tags) || data.tags.length < 1 || data.tags.length > 6) addIssue(errors, 'tags', '需要 1–6 个标签')
  }
  if (data.draft !== (data.visibility === 'draft')) {
    addIssue(errors, 'visibility', 'draft 与 visibility 必须同时表示草稿或同时表示非草稿')
  }

  if (kind === 'articles') {
    enumValue(errors, data.maintenance, ['active', 'stable', 'archived'], 'maintenance')
    enumValue(errors, data.license, taxonomy.licenses, 'license')
    if (data.pinTop < 0 || data.pinTop > 3 || !Number.isInteger(data.pinTop)) addIssue(errors, 'pinTop', '置顶级别必须是 0–3 的整数')
    if (data.seriesOrder != null && (!Number.isInteger(data.seriesOrder) || data.seriesOrder < 1)) addIssue(errors, 'seriesOrder', '系列序号必须是正整数')
    if (data.cover && !data.coverAlt) addIssue(errors, 'coverAlt', '使用封面时必须填写替代文本')
  }
  if (kind === 'resources') {
    enumValue(errors, data.resourceType, taxonomy.resourceTypes, 'resourceType')
    enumValue(errors, data.status, taxonomy.resourceStatuses, 'status')
    enumValue(errors, data.sourceKind, ['personal-note', 'external'], 'sourceKind')
    if (data.sourceKind === 'external' && !URL_RE.test(data.sourceUrl)) addIssue(errors, 'sourceUrl', '外部资料需填写完整的 http(s) 来源地址')
    if (data.sourceUrl && !URL_RE.test(data.sourceUrl)) addIssue(errors, 'sourceUrl', '来源地址必须是完整的 http(s) URL')
    if (!DATE_RE.test(data.lastReviewedAt)) addIssue(errors, 'lastReviewedAt', '请填写最近复核日期')
    if (!Number.isInteger(data.progress) || data.progress < 0 || data.progress > 100) addIssue(errors, 'progress', '进度必须是 0–100 的整数')
    if (data.rating != null && (data.rating < 1 || data.rating > 5)) addIssue(errors, 'rating', '评分必须在 1–5 之间')
    if (data.takeaways.length > 5) addIssue(errors, 'takeaways', '核心收获最多 5 条；本人原始笔记可留空')
    if (data.cover && !data.coverAlt) addIssue(errors, 'coverAlt', '使用封面时必须填写替代文本')
  }
  if (kind === 'thoughts' && data.related.length > 6) addIssue(errors, 'related', '关联内容不能超过 6 条')
  if (kind === 'journey') {
    if (!TIMELINE_RE.test(data.startDate)) addIssue(errors, 'startDate', '时间必须是 YYYY、YYYY-MM 或 YYYY-MM-DD')
    if (data.endDate && !TIMELINE_RE.test(data.endDate)) addIssue(errors, 'endDate', '结束时间格式无效')
    requiredText(errors, data, 'dateLabel', 2, 40)
    enumValue(errors, data.kind, taxonomy.journeyKinds, 'kind')
    enumValue(errors, data.sourceLevel, ['user-provided', 'verified-summary'], 'sourceLevel')
    if (data.highlights.length > 5) addIssue(errors, 'highlights', '亮点不能超过 5 条')
    if (data.skills.length > 8) addIssue(errors, 'skills', '技能不能超过 8 项')
  }

  const content = String(body || '').trim()
  if (publish && !content) addIssue(errors, 'body', '发布前需要正文')
  if (!content) addIssue(warnings, 'body', '正文仍为空')
  if (content.length && content.length < 30) addIssue(warnings, 'body', '正文较短，请确认它能独立表达完整信息')
  if (/身份证|学号|手机号|家庭住址|证书编号/.test(content)) addIssue(warnings, 'privacy', '正文可能包含个人敏感信息，请人工复核')
  if (/(?:\/Users\/|[A-Za-z]:\\|file:\/\/)/.test(content)) addIssue(errors, 'privacy', '正文包含本地绝对路径，发布前必须移除')
  if (/\.(?:pdf|docx?|xlsx?|pptx?|zip|7z|rar)(?:[)#?\s]|$)/i.test(content)) addIssue(warnings, 'attachment', '正文可能链接到文档或压缩包，请确认已获公开授权')
  if (publish && (data.draft || data.visibility !== 'public')) addIssue(errors, 'visibility', '发布预检要求 draft=false 且 visibility=public')

  return { ok: errors.length === 0, errors, warnings, data }
}

async function walkMarkdown(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  const files = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walkMarkdown(full))
    else if (entry.isFile() && extname(entry.name) === '.md' && !entry.name.startsWith('_')) files.push(full)
  }
  return files
}

function idFromFile(kind, file) {
  return kind === 'articles' ? basename(dirname(file)) : basename(file, '.md')
}

function summaryOf(kind, id, data, file, raw) {
  return {
    kind,
    kindLabel: KIND_LABELS[kind],
    id,
    title: String(data.title || id),
    description: String(data.description || data.summary || ''),
    pubDate: dateStr(data.pubDate),
    topic: String(data.topic || ''),
    draft: Boolean(data.draft),
    visibility: String(data.visibility || (data.draft ? 'draft' : 'public')),
    featured: Boolean(data.featured),
    file: relative(PROJECT_ROOT, file).replace(/\\/g, '/'),
    version: versionOf(raw),
  }
}

export async function scanContent({ kind = '', q = '', status = 'all' } = {}) {
  const kinds = kind && assertKind(kind) ? [kind] : KINDS
  const result = []
  for (const currentKind of kinds) {
    const files = await walkMarkdown(join(CONTENT_ROOT, currentKind))
    for (const file of files) {
      if (currentKind === 'articles' && basename(file) !== 'zh-cn.md') continue
      const raw = await readFile(file, 'utf8')
      const parsed = matter(raw)
      const id = idFromFile(currentKind, file)
      result.push(summaryOf(currentKind, id, parsed.data, file, raw))
    }
  }
  const needle = q.trim().toLowerCase()
  return result
    .filter((item) => status === 'all' || (status === 'draft' ? item.draft : !item.draft && item.visibility === 'public'))
    .filter((item) => !needle || `${item.title} ${item.description} ${item.id} ${item.topic} ${item.kindLabel}`.toLowerCase().includes(needle))
    .sort((a, b) => (b.featured - a.featured) || b.pubDate.localeCompare(a.pubDate) || a.id.localeCompare(b.id))
}

export async function readContent(kind, id) {
  if (!assertKind(kind) || !safeRel(id)) return null
  const file = itemPath(kind, id)
  const [raw, stats] = await Promise.all([
    readFile(file, 'utf8').catch(() => null),
    stat(file).catch(() => null),
  ])
  if (!raw || !stats?.isFile()) return null
  const parsed = matter(raw)
  return {
    kind,
    kindLabel: KIND_LABELS[kind],
    id,
    file: relativeItemPath(kind, id),
    version: versionOf(raw),
    data: normalizeData(kind, parsed.data, id),
    body: parsed.content.replace(/^\n/, ''),
  }
}

export async function createContent(kind, id) {
  if (!assertKind(kind)) return { error: '不支持的内容类型', status: 400 }
  const rel = safeRel(id)
  if (!rel || rel.includes('/')) return { error: '内容标识无效', status: 400 }
  const file = itemPath(kind, rel)
  if (await stat(file).then(() => true).catch(() => false)) return { error: '内容已存在', status: 409 }
  const today = new Date().toISOString().slice(0, 10)
  const common = {
    title: kind === 'thoughts' ? '新的随想' : '未命名内容',
    description: '',
    pubDate: today,
    topic: taxonomy.topics[0],
    tags: ['待整理'],
    draft: true,
    visibility: 'draft',
  }
  const templates = {
    articles: { ...common, kind: 'article', maintenance: 'active', cover: '', coverAlt: '', featured: false, pinTop: 0, lang: 'zh-cn', canonical: '', license: taxonomy.licenses[0] },
    resources: { ...common, resourceType: 'note', sourceKind: 'personal-note', sourceUrl: '', language: 'zh-cn', status: 'inbox', progress: 0, rating: null, lastReviewedAt: today, cover: '', coverAlt: '', takeaways: [] },
    thoughts: { ...common, related: [] },
    journey: { title: '未命名经历', pubDate: today, startDate: today, endDate: null, dateLabel: today, kind: 'milestone', summary: '', highlights: [], skills: [], featured: false, order: 0, sourceLevel: 'user-provided', draft: true, visibility: 'draft' },
  }
  const data = normalizeData(kind, templates[kind], rel)
  await mkdir(dirname(file), { recursive: true })
  await writeTextAtomic(file, matter.stringify('', data))
  return readContent(kind, rel)
}

export async function saveContent(kind, id, payload) {
  const current = await readContent(kind, id)
  if (!current) return { error: '内容不存在', status: 404 }
  if (!payload?.version) return { error: '缺少文件版本，已拒绝覆盖', status: 409 }
  if (payload.version !== current.version) return { error: '文件已在别处更新，请刷新后再合并修改', status: 409, conflict: true, current }
  const check = validateContent(kind, id, payload.data, payload.body, { publish: false })
  if (!check.ok) return { error: '字段校验未通过', status: 400, ...check }
  const file = itemPath(kind, id)
  await writeTextAtomic(file, matter.stringify(String(payload.body || ''), check.data))
  return { ...(await readContent(kind, id)), warnings: check.warnings }
}

export async function preflightContent(kind, id, payload) {
  const current = await readContent(kind, id)
  const data = payload?.data || current?.data
  const body = payload?.body ?? current?.body ?? ''
  if (!data) return { ok: false, errors: [{ field: 'content', message: '内容不存在' }], warnings: [] }
  return validateContent(kind, id, data, body, { publish: true })
}

export async function trashContent(kind, id) {
  const current = await readContent(kind, id)
  if (!current) return { error: '内容不存在', status: 404 }
  const source = kind === 'articles' ? dirname(itemPath(kind, id)) : itemPath(kind, id)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = join(TRASH_ROOT, stamp, kind, kind === 'articles' ? id : `${id}.md`)
  await mkdir(dirname(target), { recursive: true })
  await rename(source, target)
  const mediaSource = join(MEDIA_ROOT, kind, id)
  const mediaTarget = join(TRASH_ROOT, stamp, 'media', kind, id)
  let mediaRecoverableAt = ''
  if (await stat(mediaSource).then((entry) => entry.isDirectory()).catch(() => false)) {
    await mkdir(dirname(mediaTarget), { recursive: true })
    await rename(mediaSource, mediaTarget)
    mediaRecoverableAt = relative(PROJECT_ROOT, mediaTarget).replace(/\\/g, '/')
  }
  return {
    ok: true,
    recoverableAt: relative(PROJECT_ROOT, target).replace(/\\/g, '/'),
    mediaRecoverableAt,
  }
}

export async function overviewStats() {
  const items = await scanContent()
  const counts = Object.fromEntries(KINDS.map((kind) => [kind, items.filter((item) => item.kind === kind).length]))
  const drafts = items.filter((item) => item.draft || item.visibility === 'draft').length
  const published = items.filter((item) => !item.draft && item.visibility === 'public').length
  let cjk = 0
  let latin = 0
  for (const item of items) {
    const detail = await readContent(item.kind, item.id)
    const body = detail?.body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '') || ''
    cjk += (body.match(/[\u4e00-\u9fff]/g) || []).length
    latin += (body.match(/[A-Za-z0-9]+/g) || []).length
  }
  return { total: items.length, published, drafts, counts, words: { cjk, latin, total: cjk + latin }, recent: items.slice(0, 8) }
}

export function contentMeta() {
  return {
    kinds: KINDS.map((kind) => ({ value: kind, label: KIND_LABELS[kind] })),
    taxonomy,
    localOnly: true,
    trashRoot: relative(PROJECT_ROOT, TRASH_ROOT).replace(/\\/g, '/'),
  }
}
