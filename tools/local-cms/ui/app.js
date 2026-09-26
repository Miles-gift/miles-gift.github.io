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
	publishView.hidden = true;
	editorView.hidden = false;
	tabs.hidden = true;
	document.querySelector('#page-title').textContent = '文章编辑';
	document.querySelector('#page-lede').textContent = '修改文章内容并保存到本机工作区。';
	document.querySelector('#new-post').hidden = true;
	document.querySelector('#workspace-notice').hidden = true;
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showList() {
	listView.hidden = false;
	settingsView.hidden = true;
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
	tabs.hidden = false;
	document.querySelector('#page-title').textContent = '博客设置';
	document.querySelector('#page-lede').textContent = '编辑博客页面展示的标题、说明和图片。';
	document.querySelector('#new-post').hidden = true;
	setActiveTab('settings');
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showPublish() {
	listView.hidden = true;
	editorView.hidden = true;
	settingsView.hidden = true;
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
	for (const [id, name] of [['articles-tab', 'articles'], ['settings-tab', 'settings'], ['publish-tab', 'publish']]) {
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
			updateDirtyState();
		}
		setEditorMessage(`图片已压缩并保存在本机：${Math.round(result.bytes / 1024)} KB。发布文章时会一同上传。`, 'is-success');
	} catch (error) {
		setEditorMessage(error.message, 'is-error');
	}
}

async function previewPage(pathname) {
	const popup = window.open('about:blank', '_blank');
	if (pathname.startsWith('/blog/') && editor && isDirty && !(await savePost())) { popup?.close(); return; }
	if (settingsDirty && !(await saveSettings())) { popup?.close(); return; }
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

function renderPublishSummary(summary) {
	const target = document.querySelector('#publish-target');
	target.textContent = `${summary.target} · ${summary.branch || '未知分支'}`;
	const status = document.querySelector('#publish-status');
	status.textContent = summary.canPublish ? `发现 ${summary.changeCount} 项待发布变更。` : summary.changeCount ? '当前有阻塞项，处理后才能发布。' : '发布清单为空。';
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
	document.querySelector('#publish-now').disabled = !summary.canPublish || Boolean(publishView.dataset.running === 'true');
	document.querySelector('#publish-message').textContent = summary.canPublish
		? '私有草稿不会进入 GitHub；提交前会显示检查结果。'
		: summary.branch !== 'main' ? '正式发布仅从 main 推送；合并 CMS 实施分支后可启用。' : '没有内容被发布。';
}

async function loadPublishSummary() {
	try {
		const summary = await api('/api/publish/summary');
		renderPublishSummary(summary);
	} catch (error) {
		document.querySelector('#publish-status').textContent = error.message;
		document.querySelector('#publish-status').classList.add('is-error');
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
			await loadPublishSummary();
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
document.querySelector('#theme-toggle').addEventListener('click', () => {
	applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
window.addEventListener('beforeunload', (event) => {
	if (!isDirty && !settingsDirty) return;
	event.preventDefault();
	event.returnValue = '';
});

applyTheme(localStorage.getItem('cms-theme') || 'light');
void load();
