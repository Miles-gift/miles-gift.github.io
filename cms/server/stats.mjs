import { Hono } from 'hono'
import { overviewStats } from './store.mjs'

const stats = new Hono()
stats.get('/', async (c) => c.json(await overviewStats()))

export { stats }
