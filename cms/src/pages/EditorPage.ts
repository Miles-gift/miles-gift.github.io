import { ApiError, api } from '../api'
import { el, escapeHtml } from '../dom'
import { editHash, navigate } from '../router'
import type { ContentData, ContentDetail, ContentKind, MetaInfo, PreflightResult, ValidationIssue } from '../types'
import { toast } from '../ui'

interface EditorState {
  detail: ContentDetail
  meta: MetaInfo
  data: ContentData
  body: string
  snapshot: string
  dirty: boolean
  saving: boolean
  previewTimer: number
  previewSeq: number
}

interface FieldDef {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'select' | 'checkbox' | 'number'
  options?: string[]
  array?: boolean
  nullable?: boolean
  wide?: boolean
  help?: string
  placeholder?: string
}

interface AppRoot extends HTMLElement { __cleanup?: () => void }

const typeLabels: Record<ContentKind, string> = { articles: '长篇札记', resources: '原文资料', thoughts: '灵光便笺', journey: '旅程' }

export async function renderEditor(root: HTMLElement, kind: ContentKind, id: string) {
  let detail: ContentDetail
  let meta: MetaInfo
  try {
    ;[detail, meta] = await Promise.all([api.get(kind, id), api.meta()])
  } catch (error) {
    root.append(el('main', { class: 'cms-main' }, [
      el('div', { class: 'cms-error' }, [escapeHtml((error as Error).message)]),
      el('a', { class: 'btn', href: '#/list' }, ['返回内容列表']),
    ]))
    return
  }

  const state: EditorState = {
    detail,
    meta,
    data: structuredClone(detail.data),
    body: detail.body,
    snapshot: '',
    dirty: false,
    saving: false,
    previewTimer: 0,
    previewSeq: 0,
  }
  state.snapshot = snapshot(state)
  buildShell(root, state)
  schedulePreview(state, true)
}

function snapshot(state: EditorState) {
  return JSON.stringify({ data: state.data, body: state.body })
}

function fieldsFor(state: EditorState): FieldDef[] {
  const t = state.meta.taxonomy
  const common: FieldDef[] = [
    { key: 'title', label: '标题', wide: true },
    { key: state.detail.kind === 'journey' ? 'summary' : 'description', label: state.detail.kind === 'journey' ? '摘要' : '描述', type: 'textarea', wide: true },
    { key: 'pubDate', label: '发布日期 / 时间', help: '可填写 YYYY-MM-DD；随想也可保留完整 ISO 时间。' },
    { key: 'visibility', label: '可见性', type: 'select', options: t.visibilities, help: 'public 公开；unlisted 仅直链；draft 不进入生产构建。' },
  ]
  if (state.detail.kind !== 'journey') {
    common.push(
      { key: 'topic', label: '主题', type: 'select', options: t.topics },
      { key: 'tags', label: '标签', type: 'textarea', array: true, help: '用逗号或换行分隔，1–6 个。' },
    )
  }
  if (state.detail.kind === 'articles') return [...common,
    { key: 'maintenance', label: '维护状态', type: 'select', options: ['active', 'stable', 'archived'] },
    { key: 'updatedDate', label: '更新日期', placeholder: '可选，YYYY-MM-DD' },
    { key: 'series', label: '系列名称' },
    { key: 'seriesOrder', label: '系列序号', type: 'number', nullable: true },
    { key: 'featured', label: '首页精选', type: 'checkbox' },
    { key: 'pinTop', label: '置顶级别', type: 'number' },
    { key: 'cover', label: '封面路径', wide: true, placeholder: '/media/articles/…' },
    { key: 'coverAlt', label: '封面替代文本', wide: true },
    { key: 'canonical', label: 'Canonical URL', wide: true },
    { key: 'license', label: '许可', type: 'select', options: t.licenses },
  ]
  if (state.detail.kind === 'resources') return [...common,
    { key: 'resourceType', label: '资料类型', type: 'select', options: t.resourceTypes },
    { key: 'status', label: '学习状态', type: 'select', options: t.resourceStatuses },
    { key: 'progress', label: '进度 %', type: 'number' },
    { key: 'rating', label: '评分 1–5', type: 'number', nullable: true },
    { key: 'sourceKind', label: '来源性质', type: 'select', options: ['personal-note', 'external'], help: 'personal-note 表示本人 Markdown 原文；external 需同时填写来源地址。' },
    { key: 'sourceUrl', label: '原始来源', wide: true, placeholder: '外部资料填写 https://…；本人笔记可留空' },
    { key: 'author', label: '作者' },
    { key: 'publisher', label: '发布方' },
    { key: 'publishedYear', label: '出版年份', type: 'number', nullable: true },
    { key: 'language', label: '内容语言' },
    { key: 'startedAt', label: '开始日期' },
    { key: 'completedAt', label: '完成日期' },
    { key: 'lastReviewedAt', label: '最近复核日期' },
    { key: 'takeaways', label: '核心收获', type: 'textarea', array: true, wide: true, help: '每行一条，最多 5 条；发布本人 Markdown 原文时可留空。' },
    { key: 'cover', label: '封面路径', wide: true },
    { key: 'coverAlt', label: '封面替代文本', wide: true },
  ]
  if (state.detail.kind === 'thoughts') return [...common,
    { key: 'related', label: '关联内容标识', type: 'textarea', array: true, wide: true, help: '用逗号或换行分隔，最多 6 条。' },
  ]
  return [...common,
    { key: 'startDate', label: '开始时间', help: 'YYYY、YYYY-MM 或 YYYY-MM-DD' },
    { key: 'endDate', label: '结束时间', nullable: true },
    { key: 'dateLabel', label: '展示时间' },
    { key: 'kind', label: '经历类型', type: 'select', options: t.journeyKinds },
    { key: 'organization', label: '组织 / 学校' },
    { key: 'role', label: '角色' },
    { key: 'location', label: '地点' },
    { key: 'projectTitle', label: '项目名称' },
    { key: 'highlights', label: '关键结果', type: 'textarea', array: true, wide: true, help: '每行一条，最多 5 条；不要从证书反推个人职责。' },
    { key: 'skills', label: '技能', type: 'textarea', array: true, help: '用逗号或换行分隔。' },
    { key: 'sourceLevel', label: '事实来源级别', type: 'select', options: ['user-provided', 'verified-summary'] },
    { key: 'featured', label: '重点展示', type: 'checkbox' },
    { key: 'order', label: '时间线顺序', type: 'number' },
  ]
}

function buildShell(root: HTMLElement, state: EditorState) {
  const form = el('div', { class: 'form-grid', id: 'content-form' })
  for (const field of fieldsFor(state)) form.append(buildField(field, state))
  const shell = el('div', { class: 'editor-shell' }, [
    el('header', { class: 'editor-topbar' }, [
      el('a', { class: 'back-link', href: '#/list' }, ['内容']),
      el('span', { class: 'editor-slash', 'aria-hidden': 'true' }, ['/']),
      el('span', { class: 'type-chip' }, [typeLabels[state.detail.kind]]),
      el('strong', { class: 'editor-id mono' }, [state.detail.id]),
      el('span', { class: 'save-state', id: 'save-state' }, ['已同步']),
      el('div', { class: 'editor-actions' }, [
        el('button', { class: 'btn', type: 'button', onclick: () => openPublished(state) }, ['查看页面']),
        el('button', { class: 'btn', type: 'button', onclick: () => togglePreview() }, ['切换预览']),
        el('button', { class: 'btn btn-danger', type: 'button', onclick: () => removeItem(state) }, ['移入回收区']),
        el('button', { class: 'btn', type: 'button', id: 'btn-save', onclick: () => save(state) }, ['保存']),
        el('button', { class: 'btn btn-primary', type: 'button', id: 'btn-preflight', onclick: () => runPreflight(state) }, ['发布预检']),
      ]),
    ]),
    el('main', { class: 'editor-main', id: 'editor-main' }, [
      el('section', { class: 'editor-workspace' }, [
        el('div', { class: 'editor-intro' }, [
          el('div', {}, [
            el('p', { class: 'editor-kicker' }, ['CONTENT RECORD']),
            el('h1', {}, [String(state.data.title || state.detail.id)]),
          ]),
          el('p', { class: 'editor-file mono' }, [state.detail.file]),
        ]),
        el('details', { class: 'metadata-panel', open: true }, [
          el('summary', {}, [el('span', {}, ['字段与发布状态']), el('small', {}, ['标识创建后不可在工作台内修改'])]),
          form,
          (state.detail.kind === 'articles' || state.detail.kind === 'resources') ? uploadRow(state) : null,
        ]),
        toolbar(),
        el('textarea', { class: 'md-editor', id: 'md-editor', spellcheck: true, value: state.body, placeholder: '用 Markdown 写下正文。把事实、判断与来源交代清楚。' }),
      ]),
      el('aside', { class: 'editor-preview', id: 'editor-preview' }, [
        el('div', { class: 'preview-bar' }, [
          el('span', {}, ['实时预览']),
          el('span', { id: 'preview-status' }, ['等待渲染']),
        ]),
        el('iframe', { class: 'preview-frame', id: 'preview-frame', sandbox: 'allow-scripts', title: 'Markdown 实时预览' }),
        el('section', { class: 'preflight-panel', id: 'preflight-panel' }, [
          el('h2', {}, ['发布检查']),
          el('p', {}, ['保存为 public 后运行预检；构建、Git 推送与线上核对仍按发布 SOP 执行。']),
        ]),
      ]),
    ]),
  ])
  root.append(shell)

  const md = root.querySelector('#md-editor') as HTMLTextAreaElement
  md.addEventListener('input', () => {
    state.body = md.value
    markDirty(state)
  })
  const onKey = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      save(state)
    }
  }
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!state.dirty) return
    event.preventDefault()
    event.returnValue = ''
  }
  document.addEventListener('keydown', onKey)
  window.addEventListener('beforeunload', onBeforeUnload)
  ;(root as AppRoot).__cleanup = () => {
    clearTimeout(state.previewTimer)
    document.removeEventListener('keydown', onKey)
    window.removeEventListener('beforeunload', onBeforeUnload)
  }
}

function buildField(def: FieldDef, state: EditorState) {
  const value = state.data[def.key]
  let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  if (def.type === 'select') {
    input = el('select', { class: 'input', id: `f-${def.key}` }, (def.options || []).map((option) =>
      el('option', { value: option, selected: String(value ?? '') === option }, [option]),
    ))
  } else if (def.type === 'textarea') {
    const rendered = def.array && Array.isArray(value) ? value.join('\n') : String(value ?? '')
    input = el('textarea', { class: 'input field-textarea', id: `f-${def.key}`, rows: def.array ? 3 : 2, value: rendered, placeholder: def.placeholder || '' })
  } else {
    input = el('input', {
      class: 'input',
      id: `f-${def.key}`,
      type: def.type === 'checkbox' ? 'checkbox' : def.type === 'number' ? 'number' : 'text',
      checked: def.type === 'checkbox' ? Boolean(value) : undefined,
      value: def.type === 'checkbox' ? undefined : String(value ?? ''),
      placeholder: def.placeholder || '',
    })
  }
  const eventName = def.type === 'checkbox' || def.type === 'select' ? 'change' : 'input'
  input.addEventListener(eventName, () => {
    let next: unknown
    if (def.type === 'checkbox') next = (input as HTMLInputElement).checked
    else if (def.array) next = input.value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
    else if (def.type === 'number') next = input.value === '' && def.nullable ? null : Number(input.value)
    else next = input.value
    state.data[def.key] = next
    if (def.key === 'visibility') state.data.draft = next === 'draft'
    if (def.key === 'title') {
      const heading = document.querySelector('.editor-intro h1')
      if (heading) heading.textContent = String(next || state.detail.id)
    }
    markDirty(state)
  })
  return el('label', { class: `form-field${def.wide ? ' wide' : ''}${def.type === 'checkbox' ? ' checkbox-field' : ''}` }, [
    el('span', {}, [def.label]),
    input,
    def.help ? el('small', {}, [def.help]) : null,
  ])
}

function toolbar() {
  const tools: [string, string, string][] = [
    ['加粗', '**', '**'], ['斜体', '*', '*'], ['行内代码', '`', '`'], ['链接', '[', '](https://)'], ['公式', '$', '$'], ['提示', ':::note{name="提示"}\n', '\n:::'],
  ]
  return el('div', { class: 'editor-toolbar', role: 'toolbar', 'aria-label': 'Markdown 快速插入' }, tools.map(([label, before, after]) =>
    el('button', { class: 'tool-btn', type: 'button', onclick: () => insertText(before, after) }, [label]),
  ))
}

function insertText(before: string, after: string) {
  const md = document.querySelector('#md-editor') as HTMLTextAreaElement | null
  if (!md) return
  const start = md.selectionStart
  const end = md.selectionEnd
  const selected = md.value.slice(start, end)
  md.setRangeText(before + selected + after, start, end, 'end')
  if (!selected) md.setSelectionRange(start + before.length, start + before.length)
  md.focus()
  md.dispatchEvent(new Event('input', { bubbles: true }))
}

function uploadRow(state: EditorState) {
  return el('div', { class: 'upload-row' }, [
    el('div', {}, [el('strong', {}, ['图片处理']), el('p', {}, ['PNG、JPEG、WebP、AVIF，最大 8 MB；自动限边并转为 WebP。'])]),
    el('button', { class: 'btn', type: 'button', id: 'btn-upload', onclick: () => pickFile(state) }, ['选择图片']),
  ])
}

function markDirty(state: EditorState) {
  state.dirty = snapshot(state) !== state.snapshot
  const status = document.querySelector('#save-state')
  if (status) {
    status.textContent = state.dirty ? '有未保存修改' : '已同步'
    status.classList.toggle('is-dirty', state.dirty)
  }
  resetPreflight()
  schedulePreview(state)
}

function schedulePreview(state: EditorState, immediate = false) {
  clearTimeout(state.previewTimer)
  state.previewTimer = window.setTimeout(() => renderPreview(state), immediate ? 0 : 450)
}

async function renderPreview(state: EditorState) {
  const frame = document.querySelector('#preview-frame') as HTMLIFrameElement | null
  const status = document.querySelector('#preview-status')
  if (!frame) return
  const seq = ++state.previewSeq
  if (status) status.textContent = '渲染中'
  try {
    const doc = await api.preview(state.detail, state.data, state.body)
    if (seq !== state.previewSeq) return
    frame.srcdoc = doc
    if (status) status.textContent = '已更新'
  } catch (error) {
    if (seq !== state.previewSeq) return
    if (status) status.textContent = '渲染失败'
    frame.srcdoc = `<html><body style="font-family:system-ui;padding:24px;color:#b42318">${escapeHtml((error as Error).message)}</body></html>`
  }
}

async function save(state: EditorState): Promise<boolean> {
  if (state.saving) return false
  state.saving = true
  const button = document.querySelector('#btn-save') as HTMLButtonElement | null
  if (button) button.disabled = true
  try {
    const saved = await api.save(state.detail, state.data, state.body)
    state.detail = saved
    state.data = structuredClone(saved.data)
    state.body = saved.body
    state.snapshot = snapshot(state)
    state.dirty = false
    const status = document.querySelector('#save-state')
    if (status) { status.textContent = '已同步'; status.classList.remove('is-dirty') }
    toast(saved.warnings?.length ? `已保存，仍有 ${saved.warnings.length} 条提醒` : '已保存')
    return true
  } catch (error) {
    showSaveFailure(error, state)
    return false
  } finally {
    state.saving = false
    if (button) button.disabled = false
  }
}

function showSaveFailure(error: unknown, state: EditorState) {
  const apiError = error as ApiError
  if (apiError.status === 409) {
    const panel = document.querySelector('#preflight-panel') as HTMLElement
    panel.innerHTML = ''
    panel.className = 'preflight-panel is-error'
    panel.append(
      el('h2', {}, ['检测到文件冲突']),
      el('p', {}, ['磁盘上的文件已经变化，工作台没有覆盖它。请先复制当前修改，再重新载入并人工合并。']),
      el('button', { class: 'btn', type: 'button', onclick: () => reloadAfterConflict(state) }, ['重新载入磁盘版本']),
    )
  } else {
    const issues = (apiError.payload?.errors || []) as ValidationIssue[]
    renderIssues({ ok: false, errors: issues.length ? issues : [{ field: 'save', message: apiError.message }], warnings: [] })
  }
  toast(apiError.message || '保存失败', 'error')
}

async function reloadAfterConflict(state: EditorState) {
  if (!window.confirm('重新载入会丢弃工作台中尚未保存的修改，继续？')) return
  navigate(editHash(state.detail.kind, state.detail.id))
}

async function runPreflight(state: EditorState) {
  if (state.dirty && !(await save(state))) return
  try {
    const result = await api.preflight(state.detail, state.data, state.body)
    renderIssues(result)
    toast(result.ok ? '发布预检通过' : '发布预检未通过', result.ok ? 'info' : 'error')
  } catch (error) {
    const apiError = error as ApiError
    const result = apiError.payload as unknown as PreflightResult
    renderIssues(result.errors ? result : { ok: false, errors: [{ field: 'preflight', message: apiError.message }], warnings: [] })
    toast('发布预检未通过', 'error')
  }
}

function renderIssues(result: PreflightResult) {
  const panel = document.querySelector('#preflight-panel') as HTMLElement | null
  if (!panel) return
  panel.innerHTML = ''
  panel.className = `preflight-panel ${result.ok ? 'is-ok' : 'is-error'}`
  panel.append(el('h2', {}, [result.ok ? '内容检查通过' : '需要修正后再发布']))
  if (result.ok) panel.append(el('p', {}, ['字段、正文、可见性与基础隐私提示均已检查。下一步执行生产构建。']))
  if (result.errors?.length) panel.append(issueList('阻断项', result.errors))
  if (result.warnings?.length) panel.append(issueList('人工确认', result.warnings))
}

function issueList(title: string, issues: ValidationIssue[]) {
  return el('div', { class: 'issue-group' }, [
    el('strong', {}, [title]),
    el('ul', {}, issues.map((issue) => el('li', {}, [el('code', {}, [issue.field]), ` ${issue.message}`]))),
  ])
}

function resetPreflight() {
  const panel = document.querySelector('#preflight-panel') as HTMLElement | null
  if (!panel) return
  panel.className = 'preflight-panel'
  panel.innerHTML = '<h2>发布检查</h2><p>内容已经变化，请保存后重新运行预检。</p>'
}

async function pickFile(state: EditorState) {
  const input = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/avif' })
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const result = await api.upload(file, state.detail.kind, state.detail.id)
      state.data.cover = result.url
      const field = document.querySelector('#f-cover') as HTMLInputElement | null
      if (field) field.value = result.url
      markDirty(state)
      toast(`已优化为 ${result.width}×${result.height} WebP，请补充替代文本并保存`)
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  })
  input.click()
}

async function removeItem(state: EditorState) {
  if (!window.confirm(`将“${state.data.title || state.detail.id}”移入本地回收区？该操作不会永久删除文件。`)) return
  try {
    const result = await api.remove(state.detail.kind, state.detail.id)
    toast(`已移入 ${result.recoverableAt}`)
    navigate('#/list')
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}

function togglePreview() {
  document.querySelector('#editor-main')?.classList.toggle('no-preview')
}

function openPublished(state: EditorState) {
  const path = `/${state.detail.kind}/${encodeURIComponent(state.detail.id)}/`
  const base = localStorage.getItem('cms-blog-base') || 'http://localhost:4321'
  window.open(base + path, '_blank', 'noopener')
}
