import { api } from '../api'
import { el, escapeHtml } from '../dom'
import { editHash } from '../router'
import type { ContentKind, ContentSummary, Stats } from '../types'
import { pageHeader } from './header'
import { openNewModal } from './new-article'

const fmt = new Intl.NumberFormat('zh-CN')
const labels: Record<ContentKind, string> = { articles: '长篇札记', resources: '原文资料', thoughts: '灵光便笺', journey: '旅程' }

export async function renderOverview(root: HTMLElement) {
  const main = el('main', { class: 'cms-main dashboard' }, [el('div', { class: 'cms-empty' }, ['正在读取内容状态…'])])
  root.append(pageHeader('overview', el('button', { class: 'btn btn-primary', id: 'btn-new', onclick: () => openNewModal(root) }, ['新建内容'])), main)
  try {
    const stats = await api.stats()
    main.innerHTML = ''
    renderDashboard(main, stats)
  } catch (error) {
    main.innerHTML = ''
    main.append(el('section', { class: 'cms-error' }, [
      el('h1', {}, ['无法读取工作台']),
      el('p', {}, [escapeHtml((error as Error).message)]),
      el('p', {}, ['确认使用 pnpm cms 启动服务，且端口 5188 未被占用。']),
    ]))
  }
}

function renderDashboard(main: HTMLElement, stats: Stats) {
  const ratio = stats.total ? Math.round(stats.published / stats.total * 100) : 0
  main.append(
    el('section', { class: 'dashboard-hero' }, [
      el('div', {}, [
        el('p', { class: 'page-kicker' }, ['LOCAL PUBLISHING DESK']),
        el('h1', {}, [
          el('span', {}, ['先把一件事说清楚，']),
          el('span', {}, ['再让它抵达公开世界。']),
        ]),
      ]),
      el('div', { class: 'hero-gauge', style: `--progress:${ratio}%` }, [
        el('strong', {}, [`${ratio}%`]),
        el('span', {}, ['内容已公开']),
      ]),
    ]),
    el('section', { class: 'stat-ribbon', 'aria-label': '内容统计' }, [
      metric('全部记录', stats.total),
      metric('公开内容', stats.published),
      metric('草稿', stats.drafts),
      metric('正文字数', stats.words.total),
    ]),
    contentMap(stats),
    el('section', { class: 'dashboard-grid' }, [workflowPanel(), recentPanel(stats.recent)]),
  )
}

function metric(label: string, value: number) {
  return el('div', { class: 'metric' }, [el('strong', {}, [fmt.format(value)]), el('span', {}, [label])])
}

function contentMap(stats: Stats) {
  const descriptions: Record<ContentKind, string> = {
    articles: '展开一段所思所想', resources: '保留 Markdown 原文', thoughts: '接住片刻念头', journey: '标记真实坐标',
  }
  return el('section', { class: 'content-map' }, (Object.keys(labels) as ContentKind[]).map((kind) =>
    el('a', { href: `#/list`, class: `content-map-item type-${kind}` }, [
      el('span', { class: 'type-signal', 'aria-hidden': 'true' }),
      el('div', {}, [el('strong', {}, [labels[kind]]), el('small', {}, [descriptions[kind]])]),
      el('b', {}, [String(stats.counts[kind] || 0)]),
    ]),
  ))
}

function workflowPanel() {
  const steps = [
    ['捕捉', '新内容先以 draft 保存，不让半成品进入生产站点。'],
    ['整理', '填写类型专属字段，补全来源、替代文本与事实边界。'],
    ['校验', '发布预检先阻断字段错误，再由构建验证全部路由。'],
    ['交付', '提交、推送、检查 Actions 与线上路径，最后记录回执。'],
  ]
  return el('section', { class: 'panel workflow-panel' }, [
    el('div', { class: 'panel-heading' }, [el('h2', {}, ['每日发布回路']), el('a', { href: '#/list' }, ['进入内容库'])]),
    el('ol', {}, steps.map(([title, copy]) => el('li', {}, [el('strong', {}, [title]), el('p', {}, [copy])]))),
  ])
}

function recentPanel(items: ContentSummary[]) {
  return el('section', { class: 'panel recent-panel' }, [
    el('div', { class: 'panel-heading' }, [el('h2', {}, ['最近变化']), el('span', {}, [`${items.length} 条`])]),
    items.length ? el('div', { class: 'recent-list' }, items.map(recentItem)) : el('div', { class: 'panel-empty' }, ['还没有内容。先创建一条草稿，写清它为何值得留下。']),
  ])
}

function recentItem(item: ContentSummary) {
  return el('a', { class: 'recent-item', href: editHash(item.kind, item.id) }, [
    el('span', { class: `type-signal type-${item.kind}`, 'aria-hidden': 'true' }),
    el('div', {}, [el('strong', {}, [item.title]), el('small', {}, [`${labels[item.kind]} · ${item.pubDate.slice(0, 10)}`])]),
    el('span', { class: item.draft ? 'status-pill status-draft' : 'status-pill status-public' }, [item.draft ? '草稿' : '公开']),
  ])
}
