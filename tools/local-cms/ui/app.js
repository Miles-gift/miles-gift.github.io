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
const settingsView = document.querySelector('#settings-view');
const friendsView = document.querySelector('#friends-view');
const publishView = document.querySelector('#publish-view');
const tabs = document.querySelector('.cms-tabs');
let entries = [];
let workspaceSlugs = new Set();
let health = null;
let editor = null;
let savedFingerprint = '';
let isDirty = false;
let settingsDirty = false;
let settingsBaseHead = '';
let friendLinks = [];
let friendRevision = 'source';
let friendSavedFingerprint = '';
let friendsDirty = false;
let friendEditingId = null;
let friendLoaded = false;
let lastRemovedFriend = null;
let previewUpdateTimer = null;
let previewRequestId = 0;
let renderedPreviewMarkdown = null;
let previewHighlightRequest = 0;
let programmaticScroll = null;
let programmaticEditorSelection = null;
let editorLineMap = null;

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
	if (post.localState === 'ready') return element('span', 'cms-post-state is-local', '加入发布清单');
	if (post.localState === 'saved') return element('span', 'cms-post-state is-local', '本机已保存');
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
	settingsView.hidden = true;
	friendsView.hidden = true;
	publishView.hidden = true;
	editorView.hidden = false;
	tabs.hidden = true;
	document.querySelector('#page-title').textContent = '文章编辑';
	document.querySelector('#page-lede').textContent = '修改文章内容并保存到本机工作区。';
	document.querySelector('#new-post').hidden = true;
	document.querySelector('#workspace-notice').hidden = true;
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setEditorFullscreen(enabled) {
	const button = document.querySelector('#fullscreen-editor');
	editorLineMap = null;
	editorView.classList.toggle('is-fullscreen', enabled);
	document.body.classList.toggle('is-editor-fullscreen', enabled);
	button.setAttribute('aria-pressed', String(enabled));
	button.textContent = enabled ? '退出全屏' : '全屏编辑';
	if (enabled) document.querySelector('#field-body').focus({ preventScroll: true });
}

function showList() {
	setEditorFullscreen(false);
	listView.hidden = false;
	settingsView.hidden = true;
	friendsView.hidden = true;
	publishView.hidden = true;
	editorView.hidden = true;
	tabs.hidden = false;
	document.querySelector('#page-title').textContent = '文章';
	document.querySelector('#page-lede').textContent = '查看博客内容与本地草稿。';
	document.querySelector('#new-post').hidden = false;
	setActiveTab('articles');
	if (workspaceSlugs.size > 0) document.querySelector('#workspace-notice').hidden = false;
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSettings() {
	listView.hidden = true;
	editorView.hidden = true;
	publishView.hidden = true;
	settingsView.hidden = false;
	friendsView.hidden = true;
	tabs.hidden = false;
	document.querySelector('#page-title').textContent = '博客设置';
	document.querySelector('#page-lede').textContent = '编辑博客页面展示的标题、说明和图片。';
	document.querySelector('#new-post').hidden = true;
	setActiveTab('settings');
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showFriends() {
	listView.hidden = true;
	editorView.hidden = true;
	settingsView.hidden = true;
	publishView.hidden = true;
	friendsView.hidden = false;
	tabs.hidden = false;
	document.querySelector('#page-title').textContent = '友联';
	document.querySelector('#page-lede').textContent = '管理 About 页面展示的网站。';
	document.querySelector('#new-post').hidden = true;
	setActiveTab('friends');
	if (!friendLoaded) void loadFriendLinks();
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showPublish() {
	listView.hidden = true;
	editorView.hidden = true;
	settingsView.hidden = true;
	friendsView.hidden = true;
	publishView.hidden = false;
	tabs.hidden = false;
	document.querySelector('#page-title').textContent = '发布';
	document.querySelector('#page-lede').textContent = '检查待发布改动，确认后推送到 GitHub。';
	document.querySelector('#new-post').hidden = true;
	setActiveTab('publish');
	void loadPublishSummary();
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setActiveTab(active) {
	for (const [id, name] of [['articles-tab', 'articles'], ['settings-tab', 'settings'], ['friends-tab', 'friends'], ['publish-tab', 'publish']]) {
		const tab = document.querySelector(`#${id}`);
		tab.classList.toggle('is-active', active === name);
		if (active === name) tab.setAttribute('aria-current', 'page');
		else tab.removeAttribute('aria-current');
	}
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
		readyToPublish: document.querySelector('#field-ready-publish').checked,
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

function settingsFingerprint() {
	return JSON.stringify(collectSettings());
}

function updateSettingsDirtyState() {
	settingsDirty = settingsFingerprint() !== settingsView.dataset.savedFingerprint;
	const state = document.querySelector('#settings-save-state');
	state.textContent = settingsDirty ? '有未保存的修改' : (settingsView.dataset.local === 'true' ? '只保存在这台电脑' : '与线上设置一致');
	state.classList.toggle('is-draft', settingsDirty);
}

function fillSettings(settings, info = {}) {
	document.querySelector('#setting-site-title').value = settings.siteTitle;
	document.querySelector('#setting-site-description').value = settings.siteDescription;
	document.querySelector('#setting-blog-title').value = settings.blogHero.title;
	document.querySelector('#setting-blog-subtitle').value = settings.blogHero.subtitle;
	document.querySelector('#setting-blog-background').value = settings.blogHero.backgroundImage;
	document.querySelector('#setting-archive-title').value = settings.archiveTitle;
	document.querySelector('#setting-archive-intro').value = settings.archiveIntro;
	document.querySelector('#setting-empty-archive').value = settings.emptyArchiveIntro;
	document.querySelector('#setting-empty-list').value = settings.emptyListMessage;
	document.querySelector('#setting-default-post-hero').value = settings.defaultPostHero;
	settingsBaseHead = info.baseHead || health?.headSha || '';
	settingsView.dataset.local = String(Boolean(info.local));
	settingsView.dataset.savedFingerprint = settingsFingerprint();
	updateSettingsDirtyState();
}

function collectSettings() {
	return {
		siteTitle: document.querySelector('#setting-site-title').value,
		siteDescription: document.querySelector('#setting-site-description').value,
		blogHero: {
			title: document.querySelector('#setting-blog-title').value,
			subtitle: document.querySelector('#setting-blog-subtitle').value,
			backgroundImage: document.querySelector('#setting-blog-background').value,
		},
		archiveTitle: document.querySelector('#setting-archive-title').value,
		archiveIntro: document.querySelector('#setting-archive-intro').value,
		emptyArchiveIntro: document.querySelector('#setting-empty-archive').value,
		emptyListMessage: document.querySelector('#setting-empty-list').value,
		defaultPostHero: document.querySelector('#setting-default-post-hero').value,
	};
}

async function saveSettings() {
	const button = document.querySelector('#save-settings');
	button.disabled = true;
	document.querySelector('#settings-message').textContent = '正在校验并保存到本机…';
	try {
		const result = await api('/api/workspace/settings', { method: 'PUT', body: JSON.stringify({ settings: collectSettings(), baseHead: settingsBaseHead }) });
		settingsView.dataset.local = 'true';
		settingsView.dataset.savedFingerprint = settingsFingerprint();
		settingsBaseHead = result.baseHead;
		updateSettingsDirtyState();
		document.querySelector('#settings-message').textContent = '已保存到本机工作区，公开网站尚未变化。';
		return true;
	} catch (error) {
		document.querySelector('#settings-message').textContent = error.message;
		return false;
	} finally {
		button.disabled = false;
	}
}

function friendFingerprint() { return JSON.stringify({ version: 1, links: friendLinks }); }

function updateFriendsDirty() {
	friendsDirty = friendFingerprint() !== friendSavedFingerprint;
	const state = document.querySelector('#friends-save-state');
	state.textContent = friendsDirty ? '有未保存的修改' : '与本机保存内容一致';
	state.classList.toggle('is-draft', friendsDirty);
}

function renderFriendLinks() {
	const container = document.querySelector('#friends-list');
	container.replaceChildren();
	if (friendLinks.length === 0) {
		container.append(element('div', 'cms-empty', '还没有友联，添加第一位朋友。'));
		return;
	}
	friendLinks.forEach((friend, index) => {
		const row = element('div', `cms-friend-row${friend.enabled ? '' : ' is-disabled'}`);
		const summary = element('div', 'cms-friend-summary');
		summary.append(element('strong', '', friend.name));
		const detail = element('p', '', `${friend.url}${friend.description ? ` · ${friend.description}` : ''}`);
		summary.append(detail, element('span', 'cms-post-state', friend.enabled ? '显示' : '已隐藏'));
		const actions = element('div', 'cms-friend-actions');
		const addAction = (label, action, disabled = false, style = 'cms-button cms-quiet-button') => {
			const control = document.createElement('button');
			control.type = 'button'; control.className = style; control.textContent = label;
			control.dataset.friendAction = action; control.dataset.friendId = friend.id;
			control.setAttribute('aria-label', `${label}：${friend.name}`); control.disabled = disabled;
			actions.append(control);
		};
		addAction('编辑', 'edit', false, 'cms-button');
		addAction('上移', 'up', index === 0);
		addAction('下移', 'down', index === friendLinks.length - 1);
		addAction(friend.enabled ? '隐藏' : '显示', 'toggle');
		addAction('移除', 'remove', false, 'cms-button cms-danger-button');
		row.append(summary, actions);
		container.append(row);
	});
}

async function loadFriendLinks() {
	const message = document.querySelector('#friends-message');
	message.textContent = '正在读取友联…';
	try {
		const result = await api('/api/friend-links');
		friendLinks = result.data.links.map((friend) => ({ ...friend }));
		friendRevision = result.revision;
		friendSavedFingerprint = friendFingerprint();
		friendLoaded = true; renderFriendLinks(); updateFriendsDirty();
		message.textContent = result.local ? '已读取本机保存版本。' : '已读取公开版本，修改会先保存在本机。';
	} catch (error) {
		message.textContent = error.message;
		document.querySelector('#friends-list').replaceChildren(element('div', 'cms-error', error.message));
	}
}

function editFriend(id = null) {
	friendEditingId = id;
	const friend = friendLinks.find((item) => item.id === id);
	document.querySelector('#friend-editor-title').textContent = friend ? '编辑友联' : '添加友联';
	document.querySelector('#friend-name').value = friend?.name || '';
	document.querySelector('#friend-url').value = friend?.url || '';
	document.querySelector('#friend-avatar').value = friend?.avatar || '';
	document.querySelector('#friend-description').value = friend?.description || '';
	document.querySelector('#friend-enabled').checked = friend?.enabled ?? true;
	document.querySelector('#friend-form-message').textContent = '';
	document.querySelector('#friend-editor').hidden = false;
	document.querySelector('#friend-name').focus();
}

function closeFriendEditor() { document.querySelector('#friend-editor').hidden = true; friendEditingId = null; }

function commitFriendEdit() {
	const name = document.querySelector('#friend-name').value.trim();
	const rawUrl = document.querySelector('#friend-url').value.trim();
	const avatar = document.querySelector('#friend-avatar').value.trim();
	const description = document.querySelector('#friend-description').value.trim();
	const message = document.querySelector('#friend-form-message');
	if (!name || !rawUrl) { message.textContent = '名称和网址为必填项。'; return; }
	if (/[，。！？；：]$/.test(rawUrl)) { message.textContent = '网址末尾包含中文标点，请确认并移除后再保存。'; return; }
	let url;
	try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`); }
	catch { message.textContent = '请输入有效的网址。'; return; }
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) { message.textContent = '只支持不含账号信息的 HTTP 或 HTTPS 网址。'; return; }
	if (avatar && !(/^\/images\/friend-links\/[a-z\d_-]+\.(?:avif|gif|jpe?g|png|webp)$/i.test(avatar) || /^https:\/\//i.test(avatar))) { message.textContent = '头像只接受本站友联图片路径或 HTTPS 图片地址。'; return; }
	const id = friendEditingId || crypto.randomUUID();
	const duplicate = friendLinks.find((item) => item.id !== id && new URL(item.url).href === url.href);
	if (duplicate) { message.textContent = `该网址已用于「${duplicate.name}」。`; return; }
	const entry = { id, name, url: url.href, description, avatar, enabled: document.querySelector('#friend-enabled').checked };
	if (friendEditingId) friendLinks = friendLinks.map((item) => item.id === id ? entry : item);
	else friendLinks = [...friendLinks, entry];
	closeFriendEditor(); renderFriendLinks(); updateFriendsDirty();
}

async function saveFriendLinks() {
	const button = document.querySelector('#save-friends');
	button.disabled = true;
	const message = document.querySelector('#friends-message');
	message.textContent = '正在校验并保存到本机…';
	try {
		const result = await api('/api/workspace/friend-links', { method: 'PUT', body: JSON.stringify({ data: { version: 1, links: friendLinks }, expectedRevision: friendRevision }) });
		friendRevision = result.revision; friendSavedFingerprint = friendFingerprint(); updateFriendsDirty();
		message.textContent = '已保存到本机工作区，公开网站尚未变化。';
		return true;
	} catch (error) { message.textContent = error.message; return false; }
	finally { button.disabled = false; }
}

function updateWordCount() {
	const body = document.querySelector('#field-body').value;
	const count = body.replace(/[#*`~>\[\]()\-!\s]/g, '').length;
	document.querySelector('#word-count').textContent = `${count.toLocaleString('zh-CN')} 字`;
}

function syncMarkdownScroll(source, target) {
	if (document.querySelector('#markdown-preview').hidden) return;
	if (programmaticScroll?.target === source) {
		const expected = Math.abs(source.scrollTop - programmaticScroll.top) < 2;
		programmaticScroll = null;
		if (expected) return;
	}
	const textarea = document.querySelector('#field-body');
	const preview = document.querySelector('#markdown-preview-content');
	if (source === textarea) {
		const sourceOffset = sourceOffsetAtEditorTop();
		const previewTop = previewTopForSourceOffset(sourceOffset);
		if (previewTop !== null) target.scrollTop = previewTop;
	} else {
		const sourceOffset = sourceOffsetAtPreviewTop();
		target.scrollTop = editorTopForSourceOffset(sourceOffset);
	}
	programmaticScroll = { target, top: target.scrollTop };
}

function getEditorLineMap() {
	if (editorLineMap) return editorLineMap;
	const textarea = document.querySelector('#field-body');
	const style = getComputedStyle(textarea);
	const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.75 || 22;
	const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
	const width = Math.max(1, textarea.clientWidth - padding);
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	if (context) context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
	const lines = [];
	let sourceStart = 0;
	let rowStart = 0;
	for (const line of textarea.value.split('\n')) {
		const lineWidth = context ? context.measureText(line).width : line.length * 8;
		const rows = Math.max(1, Math.ceil(lineWidth / width));
		lines.push({ sourceStart, sourceEnd: sourceStart + line.length, rowStart, rows, length: line.length });
		sourceStart += line.length + 1;
		rowStart += rows;
	}
	editorLineMap = { lines, lineHeight, totalRows: rowStart };
	return editorLineMap;
}

function sourceOffsetAtEditorTop() {
	const textarea = document.querySelector('#field-body');
	const { lines, lineHeight } = getEditorLineMap();
	const row = textarea.scrollTop / lineHeight;
	const line = lines.find((item) => item.rowStart + item.rows > row) || lines.at(-1);
	if (!line) return 0;
	const within = Math.max(0, Math.min(1, (row - line.rowStart) / line.rows));
	return line.sourceStart + Math.round(line.length * within);
}

function editorTopForSourceOffset(offset) {
	const textarea = document.querySelector('#field-body');
	const { lines, lineHeight } = getEditorLineMap();
	const line = lines.find((item) => item.sourceEnd >= offset) || lines.at(-1);
	if (!line) return 0;
	const within = line.length > 0 ? Math.max(0, Math.min(1, (offset - line.sourceStart) / line.length)) : 0;
	return Math.max(0, Math.min(textarea.scrollHeight - textarea.clientHeight, (line.rowStart + line.rows * within) * lineHeight));
}

function sourceOffsetAtPreviewTop() {
	const preview = document.querySelector('#markdown-preview-content');
	const targetY = preview.getBoundingClientRect().top + 18;
	for (const span of sourceSpans()) {
		const rect = span.getBoundingClientRect();
		if (rect.bottom <= targetY || rect.height === 0) continue;
		const start = Number(span.dataset.sourceStart);
		const end = Number(span.dataset.sourceEnd);
		const within = Math.max(0, Math.min(1, (targetY - rect.top) / rect.height));
		return start + Math.round((end - start) * within);
	}
	return 0;
}

function previewTopForSourceOffset(offset) {
	const preview = document.querySelector('#markdown-preview-content');
	for (const span of sourceSpans()) {
		const start = Number(span.dataset.sourceStart);
		const end = Number(span.dataset.sourceEnd);
		if (end <= offset) continue;
		const textNode = sourceTextNode(span);
		if (!textNode) continue;
		const textLength = textNode.length;
		const textOffset = end > start ? Math.max(0, Math.min(textLength - 1, Math.floor((offset - start) * textLength / (end - start)))) : 0;
		const range = document.createRange();
		range.setStart(textNode, textOffset);
		range.setEnd(textNode, Math.min(textLength, textOffset + 1));
		const rect = range.getBoundingClientRect();
		if (rect.height === 0) continue;
		return Math.max(0, Math.min(preview.scrollHeight - preview.clientHeight, preview.scrollTop + rect.top - preview.getBoundingClientRect().top - 18));
	}
	return null;
}

function sourceSpans() {
	return [...document.querySelectorAll('#markdown-preview-content [data-source-start][data-source-end]')];
}

function sourceTextNode(span) {
	return document.createTreeWalker(span, NodeFilter.SHOW_TEXT).nextNode();
}

function sourceRangeAt(span, textOffset) {
	const start = Number(span.dataset.sourceStart);
	const end = Number(span.dataset.sourceEnd);
	const text = sourceTextNode(span);
	if (!text || !Number.isFinite(start) || !Number.isFinite(end)) return null;
	const ratio = text.length > 0 ? (end - start) / text.length : 0;
	return { offset: Math.max(0, Math.min(end - start, Math.round(Math.max(0, Math.min(text.length, textOffset)) * ratio))) };
}

function previewTextOffset(span, node, offset) {
	if (node === span.firstChild && node.nodeType === Node.TEXT_NODE) return offset;
	const range = document.createRange();
	range.selectNodeContents(span);
	range.setEnd(node, offset);
	return range.toString().length;
}

function previewRangeForSource(start, end) {
	if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return null;
	const spans = sourceSpans();
	const first = spans.find((span) => Number(span.dataset.sourceEnd) > start && Number(span.dataset.sourceStart) < end);
	const last = [...spans].reverse().find((span) => Number(span.dataset.sourceEnd) > start && Number(span.dataset.sourceStart) < end);
	if (!first || !last) return null;
	const firstStart = Number(first.dataset.sourceStart);
	const lastStart = Number(last.dataset.sourceStart);
	const firstEnd = Number(first.dataset.sourceEnd);
	const lastEnd = Number(last.dataset.sourceEnd);
	const firstText = sourceTextNode(first);
	const lastText = sourceTextNode(last);
	if (!firstText || !lastText) return null;
	const firstLength = firstText.length;
	const lastLength = lastText.length;
	const firstOffset = firstEnd > firstStart ? Math.round(Math.max(0, start - firstStart) * firstLength / (firstEnd - firstStart)) : 0;
	const lastOffset = lastEnd > lastStart ? Math.round(Math.min(lastEnd - lastStart, end - lastStart) * lastLength / (lastEnd - lastStart)) : lastLength;
	const range = document.createRange();
	range.setStart(firstText, Math.min(firstLength, firstOffset));
	range.setEnd(lastText, Math.min(lastLength, lastOffset));
	return range;
}

function setPreviewHighlight(range) {
	const requestId = ++previewHighlightRequest;
	if (globalThis.CSS?.highlights && typeof globalThis.Highlight === 'function') {
		CSS.highlights.set('cms-preview-match', new Highlight(range));
		return;
	}
	// Keep a visible fallback for browsers without the CSS Custom Highlight API.
	requestAnimationFrame(() => {
		if (requestId !== previewHighlightRequest || !range.startContainer.isConnected || !range.endContainer.isConnected) return;
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
	});
}

function clearPreviewHighlight(removeNativeSelection = false) {
	previewHighlightRequest += 1;
	if (globalThis.CSS?.highlights) CSS.highlights.delete('cms-preview-match');
	const preview = document.querySelector('#markdown-preview-content');
	const selection = window.getSelection();
	if (removeNativeSelection && selection && (preview.contains(selection.anchorNode) || preview.contains(selection.focusNode))) selection.removeAllRanges();
}

function updatePreviewSelectionFromEditor() {
	const textarea = document.querySelector('#field-body');
	if (renderedPreviewMarkdown !== textarea.value) return;
	const start = Math.max(0, Math.min(textarea.value.length, textarea.selectionStart));
	const end = Math.max(0, Math.min(textarea.value.length, textarea.selectionEnd));
	if (start === end) {
		clearPreviewHighlight();
		return;
	}
	const range = previewRangeForSource(start, end);
	if (!range) return;
	setPreviewHighlight(range);
}

function updateEditorSelectionFromPreview() {
	const preview = document.querySelector('#markdown-preview-content');
	const selection = window.getSelection();
	if (!selection || selection.isCollapsed || !preview.contains(selection.anchorNode) || !preview.contains(selection.focusNode)) return;
	const textarea = document.querySelector('#field-body');
	if (renderedPreviewMarkdown !== textarea.value) return;
	const anchor = selection.anchorNode;
	const focus = selection.focusNode;
	const anchorSpan = anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement?.closest('[data-source-start][data-source-end]') : anchor.closest?.('[data-source-start][data-source-end]');
	const focusSpan = focus.nodeType === Node.TEXT_NODE ? focus.parentElement?.closest('[data-source-start][data-source-end]') : focus.closest?.('[data-source-start][data-source-end]');
	if (!anchorSpan || !focusSpan) return;
	const anchorPoint = sourceRangeAt(anchorSpan, previewTextOffset(anchorSpan, anchor, selection.anchorOffset));
	const focusPoint = sourceRangeAt(focusSpan, previewTextOffset(focusSpan, focus, selection.focusOffset));
	if (!anchorPoint || !focusPoint) return;
	const start = Math.min(anchorPoint.offset + Number(anchorSpan.dataset.sourceStart), focusPoint.offset + Number(focusSpan.dataset.sourceStart));
	const end = Math.max(anchorPoint.offset + Number(anchorSpan.dataset.sourceStart), focusPoint.offset + Number(focusSpan.dataset.sourceStart));
	const safeStart = Math.max(0, Math.min(textarea.value.length, start));
	const safeEnd = Math.max(safeStart, Math.min(textarea.value.length, end));
	if (safeStart === safeEnd) return;
	const sourceRange = previewRangeForSource(safeStart, safeEnd);
	if (sourceRange) setPreviewHighlight(sourceRange);
	const expectedSelection = { start: safeStart, end: safeEnd };
	programmaticEditorSelection = expectedSelection;
	textarea.focus({ preventScroll: true });
	textarea.setSelectionRange(safeStart, safeEnd);
	setTimeout(() => {
		if (programmaticEditorSelection === expectedSelection) programmaticEditorSelection = null;
	}, 250);
}

function updateMarkdownPreview() {
	clearTimeout(previewUpdateTimer);
	const panel = document.querySelector('#markdown-preview');
	if (panel.hidden) return;
	const status = document.querySelector('#markdown-preview-status');
	const markdown = document.querySelector('#field-body').value;
	const requestId = ++previewRequestId;
	status.textContent = '正在更新…';
	previewUpdateTimer = setTimeout(async () => {
		try {
			const result = await api('/api/markdown-preview', { method: 'POST', body: JSON.stringify({ markdown }) });
			if (requestId !== previewRequestId || panel.hidden) return;
			const preview = document.querySelector('#markdown-preview-content');
			clearPreviewHighlight();
			preview.innerHTML = result.html;
			renderedPreviewMarkdown = markdown;
			updatePreviewSelectionFromEditor();
			status.textContent = '已更新';
			requestAnimationFrame(() => syncMarkdownScroll(document.querySelector('#field-body'), preview));
		} catch (error) {
			if (requestId !== previewRequestId) return;
			status.textContent = error.message;
		}
	}, 180);
}

function toggleMarkdownPreview() {
	const panel = document.querySelector('#markdown-preview');
	const button = document.querySelector('#toggle-markdown-preview');
	const show = panel.hidden;
	editorLineMap = null;
	panel.hidden = !show;
	button.setAttribute('aria-expanded', String(show));
	button.textContent = show ? '隐藏预览' : '显示预览';
	if (show) updateMarkdownPreview();
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
	document.querySelector('#field-ready-publish').checked = Boolean(post.readyToPublish);
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
	updateMarkdownPreview();
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
			readyToPublish: document.querySelector('#field-ready-publish').checked,
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
		return true;
	} catch (error) {
		const details = error.issues?.length ? ' ' + error.issues.map((issue) => issue.message).join('；') : '';
		setEditorMessage(error.message + details, 'is-error');
		return false;
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
			updateMarkdownPreview();
			updateDirtyState();
		}
		setEditorMessage(`图片已压缩并保存在本机：${Math.round(result.bytes / 1024)} KB。发布文章时会一同上传。`, 'is-success');
	} catch (error) {
		setEditorMessage(error.message, 'is-error');
	}
}

async function previewPage(pathname) {
	const popup = window.open('about:blank', '_blank');
	if (pathname === '/about/' && !document.querySelector('#friend-editor').hidden) {
		popup?.close(); document.querySelector('#friend-form-message').textContent = '请先完成或取消当前编辑，再预览 About。'; return;
	}
	if (pathname.startsWith('/blog/') && editor && isDirty && !(await savePost())) { popup?.close(); return; }
	if (settingsDirty && !(await saveSettings())) { popup?.close(); return; }
	if (pathname === '/about/' && friendsDirty && !(await saveFriendLinks())) { popup?.close(); return; }
	try {
		const result = await api('/api/preview', { method: 'POST', body: JSON.stringify({ pathname }) });
		if (!popup) {
			showToast('浏览器拦截了预览窗口，请允许本地 CMS 打开新标签页。');
			return;
		}
		popup.location.href = result.url;
		showToast('已启动基于 Astro 的本地预览。');
	} catch (error) {
		popup?.close();
		showToast(error.message);
	}
}

function renderPublishSummary(summary, { preserveResult = false } = {}) {
	const status = document.querySelector('#publish-status');
	const previousStatus = status.textContent;
	const previousError = status.classList.contains('is-error');
	const message = document.querySelector('#publish-message');
	const previousMessage = message.textContent;
	const target = document.querySelector('#publish-target');
	target.textContent = `${summary.target} · ${summary.branch || '未知分支'}`;
	const migratedCount = summary.imageMigrations?.length || 0;
	status.textContent = summary.canPublish
		? `发现 ${summary.changeCount} 项待发布变更。${migratedCount ? `已自动归档并更新 ${migratedCount} 个图片引用。` : ''}`
		: summary.blockers.length ? `检查发现 ${summary.blockers.length} 个阻塞项，请处理下方报告后再发布。` : '发布清单为空。';
	status.classList.toggle('is-error', summary.blockers.length > 0);
	const list = document.querySelector('#publish-changes');
	list.replaceChildren();
	if (!summary.changes.length) list.append(element('p', 'cms-empty', '暂无待发布变更。编辑文章后勾选“加入发布清单”，或标记文章待删除。'));
	for (const change of summary.changes) {
		const row = element('div', 'cms-publish-row');
		row.append(element('strong', '', change.type), element('span', '', change.title || ''), element('code', '', change.path));
		list.append(row);
	}
	const blockers = document.querySelector('#publish-blockers');
	blockers.hidden = summary.blockers.length === 0;
	blockers.replaceChildren();
	if (summary.blockers.length) {
		blockers.append(element('h3', '', '需要先处理'));
		const items = element('ul');
		for (const message of summary.blockers) items.append(element('li', '', message));
		blockers.append(items);
	}
	document.querySelector('#publish-now').disabled = Boolean(publishView.dataset.running === 'true');
	message.textContent = summary.canPublish
		? migratedCount ? '原图片保留在原位置；统一媒体副本会随文章提交。私有草稿不会进入 GitHub。' : '私有草稿不会进入 GitHub；提交前会显示检查结果。'
		: summary.branch !== 'main' ? '正式发布仅从 main 推送；合并 CMS 实施分支后可启用。' : '没有内容被发布。';
	if (preserveResult) {
		status.textContent = previousStatus;
		status.classList.toggle('is-error', previousError);
		message.textContent = previousMessage;
	}
}

async function loadPublishSummary({ preserveResult = false } = {}) {
	try {
		const summary = await api('/api/publish/summary');
		renderPublishSummary(summary, { preserveResult });
	} catch (error) {
		document.querySelector('#publish-status').textContent = error.message;
		document.querySelector('#publish-status').classList.add('is-error');
		document.querySelector('#publish-now').disabled = Boolean(publishView.dataset.running === 'true');
	}
}

async function pollPublishRun(id) {
	try {
		const run = await api(`/api/publish/${encodeURIComponent(id)}`);
		const status = document.querySelector('#publish-status');
		status.textContent = run.message || run.phaseMessage || '发布处理中…';
		status.classList.toggle('is-error', Boolean(run.error || run.result?.workflow?.state === 'site_check_failed' || ['failure', 'cancelled', 'timed_out'].includes(run.result?.workflow?.state)));
		if (run.done) {
			const workflowLink = document.querySelector('#publish-workflow-link');
			if (run.result?.workflow?.workflowUrl) {
				workflowLink.href = run.result.workflow.workflowUrl;
				workflowLink.hidden = false;
			}
			const deploymentState = run.result?.workflow?.state;
			if (run.result?.ok && ['waiting', 'queued', 'in_progress', 'pending'].includes(deploymentState)) {
				setTimeout(() => void pollPublishRun(id), 5000);
				return;
			}
			publishView.dataset.running = 'false';
			document.querySelector('#publish-now').disabled = false;
			document.querySelector('#publish-message').textContent = run.result?.workflow?.workflowUrl
				? `提交 ${run.result.commitSha?.slice(0, 12) || ''} · GitHub Actions：${run.result.workflow.state} · ${run.result.workflow.message}`
				: run.message;
			await loadPublishSummary({ preserveResult: true });
			return;
		}
		setTimeout(() => void pollPublishRun(id), 1500);
	} catch (error) {
		publishView.dataset.running = 'false';
		document.querySelector('#publish-now').disabled = false;
		document.querySelector('#publish-status').textContent = error.message;
		document.querySelector('#publish-status').classList.add('is-error');
	}
}

async function startPublish() {
	const button = document.querySelector('#publish-now');
	try {
		if (!document.querySelector('#friend-editor').hidden) { document.querySelector('#publish-status').textContent = '请先完成或取消当前友联编辑，再发布。'; return; }
		if (friendsDirty && !(await saveFriendLinks())) return;
		document.querySelector('#publish-status').textContent = '正在重新检查发布清单…';
		document.querySelector('#publish-status').classList.remove('is-error');
		const summary = await api('/api/publish/summary');
		if (!summary.canPublish) return renderPublishSummary(summary);
		if (!window.confirm(`将 ${summary.changeCount} 项变更提交并推送到 origin/main？`)) return;
		button.disabled = true;
		publishView.dataset.running = 'true';
		document.querySelector('#publish-status').textContent = '正在启动预发布检查…';
		const run = await api('/api/publish', { method: 'POST', body: '{}' });
		void pollPublishRun(run.id);
	} catch (error) {
		publishView.dataset.running = 'false';
		button.disabled = false;
		document.querySelector('#publish-status').textContent = error.message;
		document.querySelector('#publish-status').classList.add('is-error');
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
	updateMarkdownPreview();
}

async function load() {
	try {
		const [project, result, settings] = await Promise.all([api('/api/health'), api('/api/posts'), api('/api/settings')]);
		health = project;
		if (!settingsDirty) fillSettings(settings.settings, settings);
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
document.querySelector('#friends-tab').addEventListener('click', (event) => { event.preventDefault(); showFriends(); });
document.querySelector('#friend-add').addEventListener('click', () => editFriend());
document.querySelector('#friend-cancel').addEventListener('click', closeFriendEditor);
document.querySelector('#friend-save-edit').addEventListener('click', commitFriendEdit);
document.querySelector('#save-friends').addEventListener('click', () => void saveFriendLinks());
document.querySelector('#preview-about').addEventListener('click', () => void previewPage('/about/'));
document.querySelector('#friends-list').addEventListener('click', (event) => {
	const control = event.target.closest('[data-friend-action]');
	if (!control) return;
	const index = friendLinks.findIndex((item) => item.id === control.dataset.friendId);
	if (index < 0) return;
	const action = control.dataset.friendAction;
	if (action === 'edit') { editFriend(friendLinks[index].id); return; }
	if (action === 'remove') {
		if (!window.confirm(`移除「${friendLinks[index].name}」？保存前仍可重新添加。`)) return;
		lastRemovedFriend = { friend: friendLinks[index], index };
		document.querySelector('#friend-undo').hidden = false;
		friendLinks = friendLinks.filter((item) => item.id !== control.dataset.friendId);
	} else if (action === 'toggle') {
		friendLinks[index].enabled = !friendLinks[index].enabled;
	} else if (action === 'up' && index > 0) {
		[friendLinks[index - 1], friendLinks[index]] = [friendLinks[index], friendLinks[index - 1]];
	} else if (action === 'down' && index < friendLinks.length - 1) {
		[friendLinks[index + 1], friendLinks[index]] = [friendLinks[index], friendLinks[index + 1]];
	}
	renderFriendLinks(); updateFriendsDirty();
});
document.querySelector('#friend-undo').addEventListener('click', () => {
	if (!lastRemovedFriend) return;
	friendLinks.splice(lastRemovedFriend.index, 0, lastRemovedFriend.friend);
	lastRemovedFriend = null;
	document.querySelector('#friend-undo').hidden = true;
	renderFriendLinks(); updateFriendsDirty();
});
list.addEventListener('click', (event) => {
	const target = event.target.closest('[data-action]');
	if (!target) return;
	const { action, slug } = target.dataset;
	if (action === 'edit') void openPost(slug);
	if (action === 'copy') void openPost(slug, true);
	if (action === 'delete') void removePost(slug);
	if (action === 'restore') void restorePost(slug);
});
document.querySelector('#new-post').addEventListener('click', () => {
	if (settingsDirty && !window.confirm('博客设置有未保存的修改，确定离开吗？')) return;
	newPost();
});
document.querySelector('#articles-tab').addEventListener('click', (event) => {
	event.preventDefault();
	if (settingsDirty && !window.confirm('博客设置有未保存的修改，确定离开吗？')) return;
	showList();
});
document.querySelector('#settings-tab').addEventListener('click', (event) => {
	event.preventDefault();
	if (isDirty && !window.confirm('文章有未保存的修改，确定离开吗？')) return;
	showSettings();
});
document.querySelector('#publish-tab').addEventListener('click', (event) => {
	event.preventDefault();
	if (isDirty && !window.confirm('文章有未保存的修改，确定离开吗？')) return;
	if (settingsDirty && !window.confirm('博客设置有未保存的修改，确定离开吗？')) return;
	showPublish();
});
document.querySelector('#back-to-list').addEventListener('click', () => {
	if (isDirty && !window.confirm('有未保存的修改，确定离开编辑器吗？')) return;
	showList();
});
document.querySelector('#save-post').addEventListener('click', () => void savePost());
document.querySelector('#save-post-footer').addEventListener('click', () => void savePost());
document.querySelector('#preview-post').addEventListener('click', () => editor && void previewPage(`/blog/${editor.slug}/`));
document.querySelector('#fullscreen-editor').addEventListener('click', () => setEditorFullscreen(!editorView.classList.contains('is-fullscreen')));
document.querySelector('#toggle-markdown-preview').addEventListener('click', toggleMarkdownPreview);
const markdownEditor = document.querySelector('#field-body');
const markdownPreview = document.querySelector('#markdown-preview-content');
markdownEditor.addEventListener('pointerdown', () => clearPreviewHighlight(true));
markdownPreview.addEventListener('pointerdown', () => clearPreviewHighlight(true));
markdownEditor.addEventListener('keydown', (event) => {
	if (event.shiftKey || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a')) {
		clearPreviewHighlight();
	}
});
markdownPreview.addEventListener('keydown', (event) => {
	if (event.shiftKey || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) clearPreviewHighlight();
});
markdownEditor.addEventListener('scroll', (event) => {
	syncMarkdownScroll(event.currentTarget, document.querySelector('#markdown-preview-content'));
}, { passive: true });
markdownEditor.addEventListener('select', () => {
	if (programmaticEditorSelection?.start === markdownEditor.selectionStart && programmaticEditorSelection?.end === markdownEditor.selectionEnd) {
		programmaticEditorSelection = null;
		return;
	}
	programmaticEditorSelection = null;
	updatePreviewSelectionFromEditor();
});
markdownPreview.addEventListener('scroll', (event) => {
	syncMarkdownScroll(event.currentTarget, document.querySelector('#field-body'));
}, { passive: true });
markdownPreview.addEventListener('pointerup', updateEditorSelectionFromPreview);
markdownPreview.addEventListener('keyup', updateEditorSelectionFromPreview);
markdownPreview.addEventListener('load', (event) => {
	if (event.target instanceof HTMLImageElement) syncMarkdownScroll(document.querySelector('#field-body'), event.currentTarget);
}, true);
window.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && editorView.classList.contains('is-fullscreen')) setEditorFullscreen(false);
});
document.querySelector('#save-settings').addEventListener('click', () => void saveSettings());
document.querySelector('#preview-blog').addEventListener('click', () => void previewPage('/blog/'));
document.querySelector('#publish-now').addEventListener('click', () => void startPublish());
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
for (const control of settingsView.querySelectorAll('input, textarea')) {
	control.addEventListener('input', updateSettingsDirtyState);
	control.addEventListener('change', updateSettingsDirtyState);
}
document.querySelectorAll('[data-settings-image]').forEach((button) => button.addEventListener('click', () => {
	const input = document.querySelector('#settings-image-upload');
	input.dataset.targetField = button.dataset.settingsImage;
	input.click();
}));
document.querySelector('#settings-image-upload').addEventListener('change', async (event) => {
	const input = event.currentTarget;
	const file = input.files?.[0];
	if (file) {
		try {
			const result = await api('/api/media', { method: 'POST', body: file });
			const targetId = input.dataset.targetField === 'blogHero.backgroundImage' ? '#setting-blog-background' : '#setting-default-post-hero';
			document.querySelector(targetId).value = result.path;
			updateSettingsDirtyState();
		} catch (error) { showToast(error.message); }
	}
	input.value = '';
});
document.querySelectorAll('#editor-view input, #editor-view textarea, #editor-view select').forEach((control) => {
	control.addEventListener('input', updateDirtyState);
	control.addEventListener('change', updateDirtyState);
});
document.querySelector('#field-body').addEventListener('input', () => {
	editorLineMap = null;
	updateMarkdownPreview();
});
window.addEventListener('resize', () => { editorLineMap = null; });
document.querySelector('#theme-toggle').addEventListener('click', () => {
	applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
window.addEventListener('beforeunload', (event) => {
	if (!isDirty && !settingsDirty && !friendsDirty && document.querySelector('#friend-editor').hidden) return;
	event.preventDefault();
	event.returnValue = '';
});

applyTheme(localStorage.getItem('cms-theme') || 'light');
void load();
