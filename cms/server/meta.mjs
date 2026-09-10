import { Hono } from 'hono'
import { contentMeta } from './store.mjs'

const meta = new Hono()
meta.get('/', (c) => c.json(contentMeta()))

export { meta }
