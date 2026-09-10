// 本地图片上传：校验真实格式、限制尺寸并统一转为 WebP。
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Hono } from 'hono'
import sharp from 'sharp'
import { assertKind, MEDIA_ROOT, safeRel } from './store.mjs'

const upload = new Hono()
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/avif']
const ALLOWED_FORMAT = ['png', 'jpeg', 'webp', 'avif']
const MAX_SIZE = 8 * 1024 * 1024
const MAX_EDGE = 2400

function safeStem(name) {
  return basename(name || 'image')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'image'
}

upload.post('/', async (c) => {
  const form = await c.req.parseBody().catch(() => null)
  if (!form) return c.json({ error: '无法解析表单' }, 400)
  const file = form.file
  const kind = String(form.kind || '')
  const id = safeRel(String(form.id || ''))
  if (typeof File === 'undefined' || !(file instanceof File)) return c.json({ error: '缺少图片文件' }, 400)
  if (!assertKind(kind) || !id || id.includes('/')) return c.json({ error: '内容类型或标识无效' }, 400)
  if (!ALLOWED_MIME.includes(file.type)) return c.json({ error: '仅支持 PNG、JPEG、WebP 或 AVIF；SVG 与 GIF 不接受上传' }, 400)
  if (file.size > MAX_SIZE) return c.json({ error: '图片不能超过 8 MB' }, 400)

  const source = Buffer.from(await file.arrayBuffer())
  const image = sharp(source, { failOn: 'warning', limitInputPixels: 40_000_000 })
  const metadata = await image.metadata().catch(() => null)
  if (!metadata?.format || !ALLOWED_FORMAT.includes(metadata.format)) return c.json({ error: '图片实际格式与允许类型不符' }, 400)
  if (!metadata.width || !metadata.height) return c.json({ error: '无法读取图片尺寸' }, 400)

  const output = await image
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toBuffer()
  const hash = createHash('sha256').update(output).digest('hex').slice(0, 10)
  const name = `${safeStem(file.name)}-${hash}.webp`
  const directory = join(MEDIA_ROOT, kind, id)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, name), output)
  const resultMeta = await sharp(output).metadata()

  return c.json({
    name,
    url: `/media/${kind}/${id}/${name}`,
    bytes: output.length,
    width: resultMeta.width,
    height: resultMeta.height,
    format: 'webp',
  })
})

export { upload }
