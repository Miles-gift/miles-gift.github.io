import { api } from '../api'
import { el } from '../dom'
import { editHash, navigate } from '../router'
import type { ContentKind } from '../types'
import { toast } from '../ui'

const labels: Record<ContentKind, string> = {
  articles: '长篇札记',
  resources: '原文资料',
  thoughts: '灵光便笺',
  journey: '旅程',
}

export function openNewModal(root: HTMLElement, initialKind: ContentKind = 'articles') {
  const kindSelect = el('select', { class: 'input', id: 'new-kind' }, Object.entries(labels).map(([value, label]) =>
    el('option', { value, selected: value === initialKind }, [label]),
  ))
  const idInput = el('input', { class: 'input mono', id: 'new-id', autocomplete: 'off' })
  const hint = el('small', { class: 'modal-hint', id: 'new-id-hint' })
  const overlay = el('div', { class: 'modal-overlay', role: 'presentation' }, [
    el('section', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'new-title' }, [
      el('button', { class: 'modal-close', type: 'button', 'aria-label': '关闭', onclick: () => overlay.remove() }, ['×']),
      el('p', { class: 'modal-kicker' }, ['CREATE']),
      el('h2', { class: 'modal-title', id: 'new-title' }, ['建立一条清晰的内容记录']),
      el('p', { class: 'modal-copy' }, ['新内容默认保存为草稿。标识创建后保持稳定，避免公开链接失效。']),
      el('label', { class: 'modal-field' }, ['内容类型', kindSelect]),
      el('label', { class: 'modal-field' }, ['稳定标识', idInput, hint]),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn', type: 'button', onclick: () => overlay.remove() }, ['取消']),
        el('button', { class: 'btn btn-primary', type: 'button', id: 'modal-submit', onclick: submit }, ['创建草稿']),
      ]),
    ]),
  ])
  root.append(overlay)

  let manuallyEdited = false
  idInput.addEventListener('input', () => { manuallyEdited = true })
  kindSelect.addEventListener('change', () => setSuggestion(kindSelect.value as ContentKind))
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove()
  })
  setSuggestion(initialKind)
  idInput.focus()

  async function setSuggestion(kind: ContentKind) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const placeholders: Record<ContentKind, string> = {
      articles: `new-article-${date}`,
      resources: `new-resource-${date}`,
      thoughts: `${date}-001`,
      journey: `new-milestone-${date}`,
    }
    hint.textContent = kind === 'thoughts'
      ? '格式为 YYYYMMDD-001；同一天按序号递增。'
      : '仅使用小写英文、数字和连字符。'
    if (!manuallyEdited) idInput.value = placeholders[kind]
  }

  async function submit() {
    const kind = kindSelect.value as ContentKind
    const id = idInput.value.trim()
    try {
      const created = await api.create({ kind, id })
      toast(`已创建${labels[kind]}草稿`)
      overlay.remove()
      navigate(editHash(created.kind, created.id))
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }
}
