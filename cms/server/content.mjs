import { Hono } from 'hono'
import {
  assertKind,
  createContent,
  preflightContent,
  readContent,
  saveContent,
  scanContent,
  trashContent,
} from './store.mjs'

const content = new Hono()

content.get('/', async (c) => {
  const kind = c.req.query('kind') || ''
  if (kind && !assertKind(kind)) return c.json({ error: '不支持的内容类型' }, 400)
  const items = await scanContent({
    kind,
    q: c.req.query('q') || '',
    status: c.req.query('status') || 'all',
  })
  return c.json({ items })
})

content.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body?.kind || !body?.id) return c.json({ error: 'kind 与 id 不能为空' }, 400)
  const result = await createContent(body.kind, body.id)
  if (result?.error) return c.json(result, result.status || 400)
  return c.json(result, 201)
})

content.get('/:kind/:id', async (c) => {
  const item = await readContent(c.req.param('kind'), c.req.param('id'))
  if (!item) return c.json({ error: '内容不存在' }, 404)
  return c.json(item)
})

content.put('/:kind/:id', async (c) => {
  const payload = await c.req.json().catch(() => null)
  if (!payload || typeof payload !== 'object') return c.json({ error: '无效请求体' }, 400)
  const result = await saveContent(c.req.param('kind'), c.req.param('id'), payload)
  if (result?.error) return c.json(result, result.status || 400)
  return c.json(result)
})

content.delete('/:kind/:id', async (c) => {
  const result = await trashContent(c.req.param('kind'), c.req.param('id'))
  if (result?.error) return c.json(result, result.status || 404)
  return c.json(result)
})

content.post('/:kind/:id/preflight', async (c) => {
  const payload = await c.req.json().catch(() => ({}))
  const result = await preflightContent(c.req.param('kind'), c.req.param('id'), payload)
  return c.json(result, result.ok ? 200 : 400)
})

export { content }
