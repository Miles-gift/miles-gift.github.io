// 端到端冒烟测试：对四类内容执行创建、保存、预检、冲突防护与可恢复删除，
// 同时检查真实格式图片转码和工作台核心页面。需先启动 `pnpm cms`。
import { JSDOM } from 'jsdom'

const CMS_BASE = process.env.CMS_BASE || 'http://127.0.0.1:5188'
const runToken = `${Date.now()}`
const today = new Date().toISOString().slice(0, 10)
const compactDate = today.replace(/-/g, '')
const ids = {
  articles: `smoke-article-${runToken}`,
  resources: `smoke-resource-${runToken}`,
  thoughts: `${compactDate}-999`,
  journey: `smoke-journey-${runToken}`,
}
const created = []

async function request(path, init = {}, expected = 200) {
  const response = await fetch(`${CMS_BASE}${path}`, init)
  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json() : await response.text()
  if (response.status !== expected) {
    throw new Error(`${init.method || 'GET'} ${path} 期望 ${expected}，实际 ${response.status}: ${JSON.stringify(payload)}`)
  }
  return payload
}

function json(method, value) {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }
}

function publishData(kind, original) {
  const common = {
    ...original,
    title: `CMS 冒烟测试·${kind}`,
    pubDate: today,
    draft: false,
    visibility: 'public',
  }
  if (kind === 'articles') return {
    ...common,
    description: '用于验证长篇札记从创建到发布预检的完整本地流程。',
    topic: '建站记录',
    tags: ['CMS', '发布流程'],
  }
  if (kind === 'resources') return {
    ...common,
    description: '用于验证本人 Markdown 原文在资料库中可以不填写外部来源与摘要。',
    topic: '编程与工程工具',
    tags: ['CMS', 'Markdown'],
    resourceType: 'note',
    sourceKind: 'personal-note',
    sourceUrl: '',
    status: 'reference',
    progress: 0,
    takeaways: [],
    lastReviewedAt: today,
  }
  if (kind === 'thoughts') return {
    ...common,
    pubDate: '2026-09-10T11:00:00+08:00',
    description: '用于验证灵光便笺的快速记录、保存与预检流程。',
    topic: '建站记录',
    tags: ['CMS', '便笺'],
  }
  return {
    ...common,
    summary: '用于验证旅程节点的时间、类型、事实来源与正文预检。',
    startDate: today,
    endDate: null,
    dateLabel: today,
    kind: 'milestone',
    sourceLevel: 'user-provided',
  }
}

const bodyFor = (kind) => `# ${kind} 冒烟测试\n\n这段内容只用于验证 yoyo Studio 的本地发布流程，测试结束后会移入可恢复回收区。`

async function apiFlow() {
  const meta = await request('/api/meta')
  if (meta.kinds.length !== 4 || !meta.taxonomy.topics.includes('语言学习')) throw new Error('CMS 元数据与站点 taxonomy 不一致')
  const stats = await request('/api/stats')
  if (!Number.isInteger(stats.total) || !stats.counts.articles) throw new Error('CMS 概览统计结构无效')
  console.log(`PASS: 元数据与概览统计（${stats.total} 条内容）`)

  for (const [kind, id] of Object.entries(ids)) {
    const draft = await request('/api/content', json('POST', { kind, id }), 201)
    created.push([kind, id])
    const saved = await request(`/api/content/${kind}/${id}`, json('PUT', {
      version: draft.version,
      data: publishData(kind, draft.data),
      body: bodyFor(kind),
    }))
    const preflight = await request(`/api/content/${kind}/${id}/preflight`, json('POST', {
      data: saved.data,
      body: saved.body,
    }))
    if (!preflight.ok) throw new Error(`${kind} 发布预检未通过`)
    if (kind === 'thoughts' && !String(saved.data.pubDate).includes('T')) throw new Error('灵光便笺的完整发布时间被截断')
    await request(`/api/content/${kind}/${id}`, json('PUT', {
      version: draft.version,
      data: saved.data,
      body: saved.body,
    }), 409)
    console.log(`PASS: ${kind} 创建、保存、预检与版本冲突防护`)
  }

  const invalid = new FormData()
  invalid.append('kind', 'articles')
  invalid.append('id', ids.articles)
  invalid.append('file', new File(['not an image'], 'fake.png', { type: 'image/png' }))
  await request('/api/upload', { method: 'POST', body: invalid }, 400)

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  const upload = new FormData()
  upload.append('kind', 'articles')
  upload.append('id', ids.articles)
  upload.append('file', new File([png], 'pixel.png', { type: 'image/png' }))
  const image = await request('/api/upload', { method: 'POST', body: upload })
  if (image.format !== 'webp' || !image.url.endsWith('.webp')) throw new Error('图片未转码为 WebP')
  console.log('PASS: 图片真实格式校验、限边与 WebP 转码')
}

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: `${CMS_BASE}/`,
    pretendToBeVisual: true,
  })
  const { window } = dom
  const globals = {
    window,
    document: window.document,
    location: window.location,
    navigator: window.navigator,
    localStorage: window.localStorage,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    HTMLSelectElement: window.HTMLSelectElement,
    HTMLButtonElement: window.HTMLButtonElement,
    HTMLIFrameElement: window.HTMLIFrameElement,
    Node: window.Node,
    Event: window.Event,
    HashChangeEvent: window.HashChangeEvent,
    KeyboardEvent: window.KeyboardEvent,
    BeforeUnloadEvent: window.BeforeUnloadEvent,
  }
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  }
  window.confirm = () => true
  window.open = () => null
  const realFetch = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? new URL(input, CMS_BASE).href : input
    return realFetch(url, init)
  }
}

async function waitFor(test, timeout = 12000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const result = await test()
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, 80))
  }
  return false
}

async function uiFlow() {
  installDom()
  const [{ renderOverview }, { renderList }, { renderEditor }] = await Promise.all([
    import('./src/pages/OverviewPage.ts'),
    import('./src/pages/ListPage.ts'),
    import('./src/pages/EditorPage.ts'),
  ])
  const app = document.querySelector('#app')
  await renderOverview(app)
  if (app.querySelectorAll('.metric').length !== 4 || !app.textContent.includes('yoyo Studio')) throw new Error('概览页没有正确渲染')

  app.innerHTML = ''
  await renderList(app)
  if (!app.textContent.includes('灵光便笺') || !app.querySelector('#btn-new')) throw new Error('内容列表没有正确渲染')

  app.innerHTML = ''
  await renderEditor(app, 'thoughts', ids.thoughts)
  const previewReady = await waitFor(() => app.querySelector('#preview-frame')?.srcdoc?.includes('冒烟测试'))
  if (!previewReady || !app.querySelector('#btn-save') || !app.querySelector('#btn-preflight')) throw new Error('编辑器或实时预览没有正确渲染')
  console.log('PASS: 概览、内容列表、四类标识与 Markdown 实时预览')
}

async function cleanup() {
  for (const [kind, id] of created.reverse()) {
    const response = await fetch(`${CMS_BASE}/api/content/${kind}/${id}`, { method: 'DELETE' })
    if (response.status !== 200 && response.status !== 404) throw new Error(`清理 ${kind}/${id} 失败：${response.status}`)
    if (response.ok) {
      const result = await response.json()
      if (!result.recoverableAt.startsWith('.trash/cms/')) throw new Error('删除未进入可恢复回收区')
      if (kind === 'articles' && !result.mediaRecoverableAt) throw new Error('内容图片没有随删除进入回收区')
    }
  }
  console.log('PASS: 四类测试内容与附属图片已移入可恢复回收区')
}

try {
  await apiFlow()
  await uiFlow()
  await cleanup()
  console.log('\n=== yoyo Studio 冒烟测试全部通过 ===')
} catch (error) {
  await cleanup().catch(() => {})
  console.error(error)
  process.exitCode = 1
}
