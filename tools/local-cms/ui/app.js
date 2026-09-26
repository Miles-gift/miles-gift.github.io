const sessionToken = document.querySelector('meta[name="cms-session"]')?.content || '';
const list = document.querySelector('#post-list');
const count = document.querySelector('#post-count');
const search = document.querySelector('#post-search');
const filter = document.querySelector('#status-filter');
const errorBox = document.querySelector('#load-error');
const statusBox = document.querySelector('#project-status');
const toast = document.querySelector('#toast');
const editorView = document.querySelector('#editor-view');
const listView = document.querySelector('#articles');
const tabs = document.querySelector('.cms-tabs');
let entries = [];
let workspaceSlugs = new Set();
let health = null;
let editor = null;
let savedFingerprint = '';
let isDirty = false;

async function api(path, options = {}) {
	const headers = new Headers(options.headers || {});
	if (typeof options.body === 'string') headers.set('content-type', 'application/json');
	if (options.method && options.method !== 'GET') headers.set('x-cms-session', sessionToken);
	const response = await fetch(path, { ...options, headers, cache: 'no-store' });
	const payload = await response.json().catch(() => ({}));
	if (!response.ok) {
		const error = new Error(payload.error || `请求失败（${response.status}）`);
		error.issues = payload.issues || [];
		throw error;
	}
	return payload;
}

function element(tag, className, text) {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function button(text, action, slug, className = 'cms-button') {
	const node = element('button', className, text);
	node.type = 'button';
	node.dataset.action = action;
	if (slug) node.dataset.slug = slug;
	return node;
}

function postState(post) {
	if (post.conflict) return element('span', 'cms-post-state is-draft', '有版本冲突');
	if (post.localState === 'deleted') return element('span', 'cms-post-state is-draft', '待删除');
	if (post.localState === 'saved' || post.localState === 'ready') return element('span', 'cms-post-state is-local', '本机已保存');
	if (post.localState === 'invalid') return element('span', 'cms-post-state is-draft', '校验失败');
	if (post.draft) return element('span', 'cms-post-state is-draft', '源文件草稿');
	return element('span', 'cms-post-state', '已发布');
}

function matches(post, query, state) {
	const haystack = [post.title, post.slug, post.categories?.[0], ...(post.tags || [])].join(' ').toLocaleLowerCase();
	if (query && !haystack.includes(query.toLocaleLowerCase())) return false;
	if (state === 'published' && (post.draft || post.localState === 'deleted')) return false;
	if (state === 'draft' && !post.draft) return false;
	if (state === 'local' && !['saved', 'ready', 'deleted'].includes(post.localState)) return false;
	return true;
}

function renderList() {
	const query = search.value.trim();
	const state = filter.value;
	const visible = entries.filter((post) => matches(post, query, state));
	count.textContent = `${entries.length} 篇`;
	list.replaceChildren();
	if (visible.length === 0) {
		list.append(element('div', 'cms-empty', '没有符合条件的文章。'));
		return;
	}
	for (const post of visible) {
		const row = element('article', 'cms-post-row' + (post.localState === 'deleted' ? ' is-deleted' : ''));
		const main = element('div', 'cms-post-main');
		const heading = element('h3', 'cms-post-title', post.title || '未命名文章');
		heading.append(postState(post));
		main.append(heading);
		main.append(element('p', 'cms-post-slug', `/blog/${post.slug}/`));
		const meta = element('div', 'cms-post-meta');
		meta.append(element('span', '', post.date || '无日期'));
		if (post.categories?.[0]) meta.append(element('span', '', post.categories[0]));
		for (const tag of (post.tags || []).slice(0, 4)) meta.append(element('span', 'cms-post-tag', tag));
		if ((post.tags || []).length > 4) meta.append(element('span', '', `+${post.tags.length - 4}`));
		if (post.conflict) meta.append(element('span', 'cms-post-state is-draft', '源文件已变化'));
		main.append(meta);
		if (post.validationError) main.append(element('p', 'cms-row-error', post.validationError));
		const actions = element('div', 'cms-post-actions');
		if (post.localState === 'deleted') {
			actions.append(button('恢复', 'restore', post.slug));
		} else {
			actions.append(button('编辑', 'edit', post.slug));
			actions.append(button('复制', 'copy', post.slug, 'cms-button cms-quiet-button'));
			actions.append(button('删除', 'delete', post.slug, 'cms-button cms-quiet-button'));
		}
		row.append(main, actions);
		list.append(row);
	}
}

function showToast(message) {
	toast.textContent = message;
	toast.classList.add('is-visible');
	clearTimeout(showToast.timeout);
	showToast.timeout = setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function setEditorMessage(message, state = '') {
	const target = document.querySelector('#editor-message');
	target.textContent = message;
	target.className = state;
}

function setDateValue(value) {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.valueOf())) return '';
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
		hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
	}).formatToParts(date).reduce((result, part) => {
		result[part.type] = part.value;
		return result;
	}, {});
	return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function shanghaiNow() {
	return setDateValue(new Date().toISOString());
}

function slugSuggestion() {
	const compact = shanghaiNow().replace(/[-:T]/g, '').slice(0, 12);
	return `draft-${compact}`;
}

function showEditor() {
	listView.hidden = true;
	editorView.hidden = false;
	tabs.hidden = true;
	document.querySelector('#workspace-notice').hidden = true;
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showList() {
	listView.hidden = false;
	editorView.hidden = true;
	tabs.hidden = false;
	if (workspaceSlugs.size > 0) document.querySelector('#workspace-notice').hidden = false;
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formFingerprint() {
	return JSON.stringify({
		slug: document.querySelector('#field-slug').value,
		extension: document.querySelector('#field-extension').value,
		title: document.querySelector('#field-title').value,
		date: document.querySelector('#field-date').value,
		updated: document.querySelector('#field-updated').value,
		description: document.querySelector('#field-description').value,
		category: document.querySelector('#field-category').value,
		tags: document.querySelector('#field-tags').value,
		cover: document.querySelector('#field-cover').value,
		draft: document.querySelector('#field-draft').checked,
		body: document.querySelector('#field-body').value,
	});
}

function updateDirtyState() {
	isDirty = formFingerprint() !== savedFingerprint;
	const state = document.querySelector('#editor-save-state');
	state.textContent = isDirty ? '有未保存的修改' : (editor?.localState ? '只保存在这台电脑' : '未保存');
	state.classList.toggle('is-draft', isDirty);
	updateWordCount();
}

function updateWordCount() {
	const body = document.querySelector('#field-body').value;
	const count = body.replace(/[#*`~>\[\]()\-!\s]/g, '').length;
	document.querySelector('#word-count').textContent = `${count.toLocaleString('zh-CN')} 字`;
}

function fillEditor(post, body, options = {}) {
	editor = {
		slug: post.slug,
		extension: post.extension || 'md',
		isNew: Boolean(options.isNew),
		sourceExists: Boolean(post.sourceExists),
		baseHash: post.baseHash || post.sourceHash || '',
		baseHead: post.baseHead || post.sourceHead || health?.headSha || '',
		lineEnding: post.lineEnding || '\n',
		localState: post.localState || '',
		deleted: Boolean(post.deleted),
		baseBody: options.baseBody || '',
	};
	document.querySelector('#editor-heading').textContent = options.isNew ? '新建文章' : post.title;
	document.querySelector('#field-slug').value = post.slug;
	document.querySelector('#field-slug').disabled = !options.isNew;
	document.querySelector('#slug-hint').textContent = options.isNew ? '保存后地址固定' : '已发布文章地址固定';
	document.querySelector('#field-extension').value = post.extension || 'md';
	document.querySelector('#field-extension').disabled = !options.isNew;
	document.querySelector('#field-title').value = post.title || '';
	document.querySelector('#field-date').value = setDateValue(post.date);
	document.querySelector('#field-updated').value = setDateValue(post.updated);
	document.querySelector('#field-description').value = post.description || '';
	document.querySelector('#field-category').value = post.categories?.[0] || '';
	document.querySelector('#field-tags').value = (post.tags || []).join(', ');
	document.querySelector('#field-cover').value = post.cover || '';
	document.querySelector('#field-draft').checked = Boolean(post.draft);
	document.querySelector('#field-body').value = body || '';
	document.querySelector('#delete-post').hidden = options.isNew;
	document.querySelector('#save-post').disabled = Boolean(post.deleted);
	document.querySelector('#save-post-footer').disabled = Boolean(post.deleted);
	document.querySelector('#delete-post').textContent = post.deleted ? '已标记删除' : '删除文章';
	savedFingerprint = formFingerprint();
	isDirty = false;
	setEditorMessage(post.conflict ? '源文件自打开后有变化；当前修改只保存于本地，请在发布前处理版本冲突。' : '保存只写入本机工作区，不会改动线上网站。', post.conflict ? 'is-error' : '');
	updateDirtyState();
	showEditor();
}

function newPost(seed = null) {
	const now = shanghaiNow();
	const post = seed ? { ...seed } : {};
	fillEditor({
		slug: slugSuggestion(),
		extension: 'md',
		title: '',
		date: now,
		updated: '',
		description: '',
		cover: '',
		draft: true,
		categories: [],
		tags: [],
		...post,
		sourceExists: false,
	}, seed?.body || '\n', { isNew: true });
}

async function openPost(slug, copy = false) {
	try {
		const result = await api(`/api/posts/${encodeURIComponent(slug)}`);
		if (!copy) {
			fillEditor({ ...result.post, baseHash: result.baseHash, baseHead: result.baseHead, lineEnding: result.lineEnding, deleted: result.post.deleted }, result.body, { baseBody: result.baseBody });
			return;
		}
		const cloned = {
			...result.post,
			slug: `copy-of-${slug}`,
			title: `${result.post.title}（副本）`,
			date: shanghaiNow(), updated: '', draft: true,
		sourceExists: false, localState: '', baseHash: '', baseHead: health?.headSha || '',
		};
		fillEditor(cloned, result.body, { isNew: true });
	} catch (error) {
		showToast(error.message);
	}
}

function collectMetadata() {
	const category = document.querySelector('#field-category').value.trim();
	const tags = document.querySelector('#field-tags').value.split(/[\n,，;；]+/).map((tag) => tag.trim()).filter(Boolean);
	return {
		title: document.querySelector('#field-title').value,
		date: document.querySelector('#field-date').value,
		updated: document.querySelector('#field-updated').value,
		description: document.querySelector('#field-description').value,
		cover: document.querySelector('#field-cover').value,
		draft: document.querySelector('#field-draft').checked,
		categories: category ? [category] : [],
		tags,
	};
}

async function savePost() {
	if (!editor) return;
	const title = document.querySelector('#field-title').value.trim();
	if (!title) return setEditorMessage('请先填写文章标题。', 'is-error');
	if (!document.querySelector('#field-date').value) return setEditorMessage('请先设置发布时间。', 'is-error');
	const slug = document.querySelector('#field-slug').value.trim();
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) return setEditorMessage('slug 只能使用小写英文、数字和单个连字符。', 'is-error');
	const buttons = [document.querySelector('#save-post'), document.querySelector('#save-post-footer')];
	buttons.forEach((item) => { item.disabled = true; });
	editorView.classList.add('is-saving');
	setEditorMessage('正在校验并保存到本机…');
	try {
		const payload = {
			slug,
			extension: document.querySelector('#field-extension').value,
			metadata: collectMetadata(),
			body: document.querySelector('#field-body').value,
			lineEnding: editor.lineEnding,
			baseHash: editor.baseHash,
			baseHead: editor.baseHead,
		};
		const result = await api('/api/workspace/post', {
			method: editor.isNew ? 'POST' : 'PUT',
			body: JSON.stringify(payload),
		});
		editor.slug = result.slug;
		editor.isNew = false;
		editor.sourceExists = editor.sourceExists || false;
		editor.localState = 'saved';
		editor.baseBody = document.querySelector('#field-body').value;
		document.querySelector('#field-slug').disabled = true;
		document.querySelector('#slug-hint').textContent = editor.sourceExists ? '已发布文章地址固定' : '本机草稿地址已固定';
		document.querySelector('#editor-heading').textContent = result.post.title;
		savedFingerprint = formFingerprint();
		isDirty = false;
		setEditorMessage('已保存到本机工作区；上线前还需要通过发布检查。', 'is-success');
		await load();
	} catch (error) {
		const details = error.issues?.length ? ' ' + error.issues.map((issue) => issue.message).join('；') : '';
		setEditorMessage(error.message + details, 'is-error');
	} finally {
		buttons.forEach((item) => { item.disabled = Boolean(editor?.deleted); });
		editorView.classList.remove('is-saving');
	}
}

async function removePost(slug) {
	const post = entries.find((item) => item.slug === slug);
	if (!post) return false;
	const explanation = post.sourceExists
		? `将《${post.title}》标记为待删除。线上页面会保留到之后发布确认。`
		: `从本机草稿区删除《${post.title}》？`;
	if (!window.confirm(explanation)) return false;
	try {
		await api(`/api/workspace/post/${encodeURIComponent(slug)}`, { method: 'DELETE' });
		await load();
		showToast(post.sourceExists ? '已标记待删除，尚未影响线上内容。' : '已删除本机未发布草稿。');
		return true;
	} catch (error) {
		showToast(error.message);
		return false;
	}
}

async function restorePost(slug) {
	try {
		await api(`/api/workspace/post/${encodeURIComponent(slug)}/restore`, { method: 'POST', body: '{}' });
		await load();
		showToast('已恢复本机文章状态。');
	} catch (error) {
		showToast(error.message);
	}
}

async function uploadImage(file, setCover) {
	if (!file) return;
	setEditorMessage('正在优化图片并保存到本机…');
	try {
		const result = await api('/api/media', { method: 'POST', body: file });
		if (setCover) {
			document.querySelector('#field-cover').value = result.path;
			updateDirtyState();
		} else {
			const textarea = document.querySelector('#field-body');
			const imageMarkdown = `![图片说明](${result.path})`;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const spacer = start > 0 && textarea.value[start - 1] !== '\n' ? '\n' : '';
			textarea.setRangeText(spacer + imageMarkdown + '\n', start, end, 'end');
			textarea.focus();
			updateDirtyState();
		}
		setEditorMessage(`图片已压缩并保存在本机：${Math.round(result.bytes / 1024)} KB。发布文章时会一同上传。`, 'is-success');
	} catch (error) {
		setEditorMessage(error.message, 'is-error');
	}
}

function applyTheme(theme) {
	document.documentElement.dataset.theme = theme;
	localStorage.setItem('cms-theme', theme);
}

function updateSuggestions() {
	const categories = new Set(entries.flatMap((post) => post.categories || []).filter(Boolean));
	const tags = new Set(entries.flatMap((post) => post.tags || []).filter(Boolean));
	for (const [id, values] of [['category-options', categories], ['tag-options', tags]]) {
		const target = document.querySelector(`#${id}`);
		target.replaceChildren(...[...values].sort((a, b) => a.localeCompare(b, 'zh-CN')).map((value) => {
			const option = document.createElement('option');
			option.value = value;
			return option;
		}));
	}
}

function showBodyComparison() {
	const dialog = document.querySelector('#post-dialog');
	const content = document.querySelector('#dialog-content');
	const current = document.querySelector('#field-body').value;
	document.querySelector('#dialog-title').textContent = '正文修改对比';
	content.replaceChildren();
	for (const [title, text] of [['保存前', editor?.baseBody || '（新文章没有原始正文）'], ['当前编辑', current || '（正文为空）']]) {
		const panel = element('section', 'cms-diff-panel');
		panel.append(element('h3', '', title));
		const pre = element('pre', 'cms-source', text);
		panel.append(pre);
		content.append(panel);
	}
	dialog.showModal();
}

function insertMarkdown(kind) {
	const textarea = document.querySelector('#field-body');
	const wrappers = { bold: ['**', '**', '加粗文字'], code: ['`', '`', 'code'], link: ['[', '](https://)', '链接文字'], heading: ['## ', '', '小标题'], list: ['- ', '', '列表项'] };
	const [before, after, fallback] = wrappers[kind] || [];
	if (before === undefined) return;
	const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) || fallback;
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	textarea.setRangeText(`${before}${selected}${after}`, start, end, 'select');
	if (kind === 'link') textarea.setSelectionRange(start + before.length + selected.length + 2, start + before.length + selected.length + after.length - 2);
	textarea.focus();
	updateDirtyState();
}

async function load() {
	try {
		const [project, result] = await Promise.all([api('/api/health'), api('/api/posts')]);
		health = project;
		entries = result.posts;
		updateSuggestions();
		workspaceSlugs = new Set(result.workspaceDrafts);
		statusBox.replaceChildren();
		statusBox.append(element('span', 'cms-status-dot'));
		statusBox.append(element('span', '', `${project.branch} · ${project.head} · ${project.dirtyCount ? `仓库有 ${project.dirtyCount} 项本地改动` : '仓库干净'}`));
		statusBox.classList.toggle('is-error', project.dirtyCount > 0);
		document.querySelector('#runtime-status').textContent = `Node ${project.node} · ${project.branch}`;
		const notice = document.querySelector('#workspace-notice');
		notice.hidden = workspaceSlugs.size === 0;
		if (workspaceSlugs.size > 0) document.querySelector('#workspace-summary').textContent = `${workspaceSlugs.size} 篇文章已保存在这台电脑，尚未发布。`;
		errorBox.hidden = true;
		renderList();
	} catch (error) {
		statusBox.classList.add('is-error');
		statusBox.replaceChildren(element('span', 'cms-status-dot'), element('span', '', '无法读取本地仓库'));
		errorBox.textContent = `${error.message} 请检查终端中的 CMS 错误信息后刷新页面。`;
		errorBox.hidden = false;
		list.replaceChildren();
	}
}

search.addEventListener('input', renderList);
filter.addEventListener('change', renderList);
list.addEventListener('click', (event) => {
	const target = event.target.closest('[data-action]');
	if (!target) return;
	const { action, slug } = target.dataset;
	if (action === 'edit') void openPost(slug);
	if (action === 'copy') void openPost(slug, true);
	if (action === 'delete') void removePost(slug);
	if (action === 'restore') void restorePost(slug);
});
document.querySelector('#new-post').addEventListener('click', () => newPost());
document.querySelector('#back-to-list').addEventListener('click', () => {
	if (isDirty && !window.confirm('有未保存的修改，确定离开编辑器吗？')) return;
	showList();
});
document.querySelector('#save-post').addEventListener('click', () => void savePost());
document.querySelector('#save-post-footer').addEventListener('click', () => void savePost());
document.querySelector('#delete-post').addEventListener('click', async () => {
	if (!editor?.slug) return;
	if (await removePost(editor.slug)) showList();
});
document.querySelector('#cover-upload').addEventListener('click', () => {
	const input = document.querySelector('#image-upload');
	input.dataset.useAsCover = 'true';
	input.click();
});
document.querySelector('#insert-image').addEventListener('click', () => document.querySelector('#image-upload').click());
document.querySelector('#compare-body').addEventListener('click', showBodyComparison);
document.querySelectorAll('[data-markdown]').forEach((control) => control.addEventListener('click', () => insertMarkdown(control.dataset.markdown)));
document.querySelector('#dialog-close').addEventListener('click', () => document.querySelector('#post-dialog').close());
document.querySelector('#image-upload').addEventListener('change', (event) => {
	const file = event.target.files?.[0];
	if (file) void uploadImage(file, event.target.dataset.useAsCover === 'true');
	event.target.dataset.useAsCover = '';
	event.target.value = '';
});
document.querySelectorAll('#editor-view input, #editor-view textarea, #editor-view select').forEach((control) => {
	control.addEventListener('input', updateDirtyState);
	control.addEventListener('change', updateDirtyState);
});
document.querySelector('#theme-toggle').addEventListener('click', () => {
	applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
window.addEventListener('beforeunload', (event) => {
	if (!isDirty) return;
	event.preventDefault();
	event.returnValue = '';
});

applyTheme(localStorage.getItem('cms-theme') || 'light');
void load();
