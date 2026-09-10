import { el } from '../dom'

export type PageKey = 'overview' | 'list'

export function pageHeader(active: PageKey, right?: HTMLElement) {
  return el('header', { class: 'cms-header' }, [
    el('div', { class: 'cms-header-inner' }, [
      el('a', { class: 'cms-logo', href: '#/', 'aria-label': '返回内容工作台概览' }, [
        el('span', { class: 'cms-logo-mark', 'aria-hidden': 'true' }),
        el('span', {}, ['yoyo Studio']),
      ]),
      el('nav', { class: 'cms-nav', 'aria-label': '工作台导航' }, [
        el('a', { class: `cms-nav-link${active === 'overview' ? ' active' : ''}`, href: '#/' }, ['概览']),
        el('a', { class: `cms-nav-link${active === 'list' ? ' active' : ''}`, href: '#/list' }, ['内容']),
      ]),
      el('div', { class: 'cms-header-spacer' }),
      el('span', { class: 'local-indicator', title: '服务仅监听本机地址' }, [
        el('i', { 'aria-hidden': 'true' }),
        '仅本机',
      ]),
      right,
    ]),
  ])
}
