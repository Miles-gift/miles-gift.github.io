import { api } from '../api'
import { el } from '../dom'
import { editHash } from '../router'
import type { ContentKind, ContentSummary } from '../types'
import { toast } from '../ui'
import { pageHeader } from './header'
import { openNewModal } from './new-article'

const labels: Record<string, string> = { articles: '长篇札记', resources: '原文资料', thoughts: '灵光便笺', journey: '旅程' }

export async function renderList(root: HTMLElement) {
  let q = ''
  let kind = ''
  let status = 'all'
  let timer = 0
  const list = el('div', { class: 'content-ledger', id: 'content-list' })
  const count = el('span', { class: 'cms-count', id: 'content-count' }, ['读取中'])
  const empty = el('section', { class: 'cms-empty', id: 'content-empty', hidden: true }, [
    el('h2', {}, ['没有符合条件的内容']),
    el('p', {}, ['调整类型、状态或搜索词；也可以新建一条草稿。']),
  ])
  root.append(
    pageHeader('list', el('button', { class: 'btn btn-primary', id: 'btn-new', type: 'button', onclick: () => openNewModal(root) }, ['新建内容'])),
    el('main', { class: 'cms-main content-index' }, [
      el('header', { class: 'page-heading' }, [
        el('div', {}, [el('p', { class: 'page-kicker' }, ['CONTENT LIBRARY']), el('h1', {}, ['把不同密度的内容，放进正确的容器。'])]),
        el('p', {}, ['长篇解释完整问题，资料库保留本人 Markdown 原文，便笺记录一个念头，旅程只陈述经过授权或核验的事实。']),
      ]),
      el('section', { class: 'filter-rail', 'aria-label': '内容筛选' }, [
        el('input', {
          class: 'input input-search', type: 'search', placeholder: '搜索标题、摘要、标识或主题',
          oninput: (event: Event) => { q = (event.target as HTMLInputElement).value; clearTimeout(timer); timer = window.setTimeout(load, 220) },
        }),
        el('select', { class: 'input', id: 'filter-kind', onchange: (event: Event) => { kind = (event.target as HTMLSelectElement).value; load() } }, [
          el('option', { value: '' }, ['全部类型']),
          ...Object.entries(labels).map(([value, label]) => el('option', { value }, [label])),
        ]),
        el('select', { class: 'input', id: 'filter-status', onchange: (event: Event) => { status = (event.target as HTMLSelectElement).value; load() } }, [
          el('option', { value: 'all' }, ['全部状态']),
          el('option', { value: 'published' }, ['公开']),
          el('option', { value: 'draft' }, ['草稿']),
        ]),
        count,
      ]),
      list,
      empty,
    ]),
  )

  async function load() {
    try {
      const { items } = await api.list({ q, kind, status })
      renderItems(items)
    } catch (error) {
      toast((error as Error).message, 'error')
      list.innerHTML = ''
      empty.hidden = false
      empty.querySelector('h2')!.textContent = '内容列表暂时无法读取'
      empty.querySelector('p')!.textContent = '确认本地 CMS 服务仍在运行，然后刷新页面。'
    }
  }

  function renderItems(items: ContentSummary[]) {
    list.innerHTML = ''
    count.textContent = `${items.length} 条记录`
    empty.hidden = items.length > 0
    for (const item of items) list.append(contentRow(item))
  }

  await load()
}

function contentRow(item: ContentSummary) {
  const state = item.draft || item.visibility === 'draft' ? '草稿' : item.visibility === 'unlisted' ? '仅直链' : '公开'
  return el('a', { class: 'content-row', href: editHash(item.kind, item.id) }, [
    el('div', { class: 'content-row-type' }, [
      el('span', { class: `type-signal type-${item.kind}`, 'aria-hidden': 'true' }),
      labels[item.kind],
    ]),
    el('div', { class: 'content-row-main' }, [
      el('h2', {}, [item.title || item.id]),
      item.description ? el('p', {}, [item.description]) : el('p', { class: 'is-muted' }, ['尚未填写摘要']),
    ]),
    el('div', { class: 'content-row-meta' }, [
      item.topic ? el('span', {}, [item.topic]) : null,
      el('time', { datetime: item.pubDate }, [item.pubDate ? item.pubDate.slice(0, 10) : '未定日期']),
      el('code', {}, [item.id]),
    ]),
    el('span', { class: `status-pill status-${state === '公开' ? 'public' : state === '草稿' ? 'draft' : 'unlisted'}` }, [state]),
  ])
}
