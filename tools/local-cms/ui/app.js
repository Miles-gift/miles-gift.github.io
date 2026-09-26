const sessionToken = document.querySelector('meta[name="cms-session"]')?.content || '';
const list = document.querySelector('#post-list');
const count = document.querySelector('#post-count');
const search = document.querySelector('#post-search');
const filter = document.querySelector('#status-filter');
const errorBox = document.querySelector('#load-error');
const statusBox = document.querySelector('#project-status');
const dialog = document.querySelector('#post-dialog');
const toast = document.querySelector('#toast');
let entries = [];
let workspaceSlugs = new Set();

async function api(path, options = {}) {
	const headers = new Headers(options.headers || {});
	if (options.body) headers.set('content-type', 'application/json');
	if (options.method && options.method !== 'GET') headers.set('x-cms-session', sessionToken);
	const response = await fetch(path, { ...options, headers, cache: 'no-store' });
	const payload = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(payload.error || `请求失败（${response.status}）`);
	return payload;
}

function escapeHtml(value) {
	return String(value ?? '').replace(/[&<>"']/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
	}[character]));
}

function postState(post) {
	if (workspaceSlugs.has(post.slug)) return '<span class="cms-post-state is-local">本机已保存</span>';
	if (post.draft) return '<span class="cms-post-state is-draft">草稿</span>';
	return '<span class="cms-post-state">已发布</span>';
}

function matches(post, query, state) {
	const haystack = [post.title, post.slug, post.category, ...post.tags].join(' ').toLocaleLowerCase();
	if (query && !haystack.includes(query.toLocaleLowerCase())) return false;
	if (state === 'published' && post.draft) return false;
	if (state === 'draft' && !post.draft) return false;
	if (state === 'local' && !workspaceSlugs.has(post.slug)) return false;
	return true;
}

function renderList() {
	const query = search.value.trim();
	const state = filter.value;
	const visible = entries.filter((post) => matches(post, query, state));
	count.textContent = `${entries.length} 篇`;
	if (visible.length === 0) {
		list.innerHTML = '<div class="cms-empty">没有符合条件的文章。</div>';
		return;
	}
	list.innerHTML = visible.map((post) => `
		<article class="cms-post-row">
			<div class="cms-post-main">
				<h3 class="cms-post-title">${escapeHtml(post.title)} ${postState(post)}</h3>
				<p class="cms-post-slug">/blog/${escapeHtml(post.slug)}/</p>
				<div class="cms-post-meta">
					<span>${escapeHtml(post.date || '无日期')}</span>
					${post.category ? `<span>${escapeHtml(post.category)}</span>` : ''}
					${post.tags.slice(0, 4).map((tag) => `<span class="cms-post-tag">${escapeHtml(tag)}</span>`).join('')}
					${post.tags.length > 4 ? `<span>+${post.tags.length - 4}</span>` : ''}
				</div>
			</div>
			<div class="cms-post-actions"><button class="cms-button" type="button" data-open="${escapeHtml(post.slug)}">查看源码</button></div>
		</article>
	`).join('');
}

async function openSource(slug) {
	try {
		const { post, content } = await api(`/api/posts/${encodeURIComponent(slug)}`);
		document.querySelector('#dialog-title').textContent = post.title;
		document.querySelector('#dialog-content').textContent = content;
		dialog.showModal();
	} catch (error) {
		showToast(error.message);
	}
}

function showToast(message) {
	toast.textContent = message;
	toast.classList.add('is-visible');
	clearTimeout(showToast.timeout);
	showToast.timeout = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function applyTheme(theme) {
	document.documentElement.dataset.theme = theme;
	localStorage.setItem('cms-theme', theme);
}

async function load() {
	try {
		const [health, result] = await Promise.all([api('/api/health'), api('/api/posts')]);
		entries = result.posts;
		workspaceSlugs = new Set(result.workspaceDrafts);
		statusBox.innerHTML = `<span class="cms-status-dot"></span><span>${escapeHtml(health.branch)} · ${escapeHtml(health.head)} · ${health.dirtyCount ? `仓库有 ${health.dirtyCount} 项本地改动` : '仓库干净'}</span>`;
		statusBox.classList.toggle('is-error', health.dirtyCount > 0);
		document.querySelector('#runtime-status').textContent = `Node ${health.node} · ${health.branch}`;
		if (workspaceSlugs.size > 0) {
			const notice = document.querySelector('#workspace-notice');
			notice.hidden = false;
			document.querySelector('#workspace-summary').textContent = `${workspaceSlugs.size} 篇文章已保存在这台电脑，尚未发布。`;
		}
		errorBox.hidden = true;
		renderList();
	} catch (error) {
		statusBox.classList.add('is-error');
		statusBox.querySelector('span:last-child').textContent = '无法读取本地仓库';
		errorBox.textContent = `${error.message} 请检查终端中的 CMS 错误信息后刷新页面。`;
		errorBox.hidden = false;
		list.innerHTML = '';
	}
}

search.addEventListener('input', renderList);
filter.addEventListener('change', renderList);
list.addEventListener('click', (event) => {
	const button = event.target.closest('[data-open]');
	if (button) void openSource(button.dataset.open);
});
document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
document.querySelector('#theme-toggle').addEventListener('click', () => {
	applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
applyTheme(localStorage.getItem('cms-theme') || 'light');
void load();
