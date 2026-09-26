#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashContent, parsePostSource, serializePostSource, summarizePost } from './content.mjs';
import { optimizePrivateImage } from './media.mjs';
import { readSettingsDocument, saveSettingsDocument, validateBlogSettings } from './settings.mjs';
import { createPreviewManager } from './preview.mjs';
import { getDeploymentStatus, getPublishSummary, publishWorkspace } from './publish.mjs';
import { listWorkspaceDocuments, readWorkspaceDocument, removeWorkspaceDocument, saveWorkspaceDocument } from './workspace.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const workspaceRoot = path.join(projectRoot, '.local-cms');
const postRoot = path.join(projectRoot, 'src/content/blog');
const settingsPath = path.join(projectRoot, 'src/data/blog-settings.json');
const host = '127.0.0.1';
const port = Number(process.env.CMS_PORT || 4178);
const sessionToken = randomBytes(32).toString('base64url');
const sessionHeader = 'x-cms-session';
const previewManager = createPreviewManager({ projectRoot, workspaceRoot, postRoot, settingsPath });
let publishRun = null;
const maxBodyBytes = 25 * 1024 * 1024;
const mimeTypes = {
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
};

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
	throw new Error('CMS_PORT 必须是 1024 到 65535 之间的整数。');
}

function send(response, status, body, contentType = 'text/plain; charset=utf-8') {
	response.writeHead(status, {
		'content-type': contentType,
		'cache-control': 'no-store',
		'x-content-type-options': 'nosniff',
		'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
		'cross-origin-resource-policy': 'same-origin',
	});
	response.end(body);
}

function sendJson(response, status, value) {
	send(response, status, JSON.stringify(value), 'application/json; charset=utf-8');
}

async function readRawBody(request) {
	const chunks = [];
	let size = 0;
	for await (const chunk of request) {
		size += chunk.length;
		if (size > maxBodyBytes) throw Object.assign(new Error('请求内容超过 25 MB。'), { status: 413 });
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

async function readBody(request) {
	return (await readRawBody(request)).toString('utf8');
}

function assertLocalRequest(request, url, { write = false } = {}) {
	const expectedHost = `${host}:${port}`;
	if (request.headers.host !== expectedHost) {
		throw Object.assign(new Error('只允许通过本机地址访问 CMS。'), { status: 403 });
	}
	if (write) {
		const expectedOrigin = `http://${expectedHost}`;
		if (request.headers.origin !== expectedOrigin || request.headers[sessionHeader] !== sessionToken) {
			throw Object.assign(new Error('请求来源校验失败，请刷新本地 CMS 页面后重试。'), { status: 403 });
		}
		if (url.protocol !== 'http:' || url.hostname !== host) {
			throw Object.assign(new Error('拒绝非本机写入请求。'), { status: 403 });
		}
	}
}

function assertSlug(slug) {
	if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
		throw Object.assign(new Error('slug 只能使用小写英文、数字和单个连字符。'), { status: 400 });
	}
	return slug;
}

async function git(args) {
	return execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function findSourcePost(slug) {
	const entries = await readdir(postRoot, { withFileTypes: true });
	const matches = entries.filter((entry) => entry.isFile() && ['md', 'mdx'].some((extension) => entry.name === slug + '.' + extension));
	if (matches.length > 1) throw Object.assign(new Error('同一 slug 同时存在 Markdown 与 MDX 文件：' + slug), { status: 409 });
	if (matches.length === 0) return null;
	const filename = matches[0].name;
	const extension = path.extname(filename).slice(1);
	const content = await readFile(path.join(postRoot, filename), 'utf8');
	return { slug, extension, content, hash: hashContent(content) };
}

async function readSourcePosts() {
	const entries = await readdir(postRoot, { withFileTypes: true });
	const sourcePosts = [];
	const seen = new Set();
	const head = await git(['rev-parse', 'HEAD']);
	for (const entry of entries) {
		if (!entry.isFile() || !/\.(md|mdx)$/i.test(entry.name)) continue;
		const slug = entry.name.replace(/\.(md|mdx)$/i, '');
		if (seen.has(slug)) throw Object.assign(new Error('同一 slug 同时存在 Markdown 与 MDX 文件：' + slug), { status: 409 });
		seen.add(slug);
		const extension = path.extname(entry.name).slice(1);
		const content = await readFile(path.join(postRoot, entry.name), 'utf8');
		try {
			sourcePosts.push({
				...summarizePost(content, slug, extension),
				sourceExists: true,
				sourceHash: hashContent(content),
				sourceHead: head,
				localState: 'published',
			});
		} catch (error) {
			sourcePosts.push({
				slug, extension, title: '文章校验失败', date: '', updated: '', description: '',
				cover: '', categories: [], tags: [], draft: true, sourceExists: true,
				sourceHash: hashContent(content), sourceHead: head, localState: 'invalid',
				validationError: error.message,
			});
		}
	}
	return sourcePosts;
}

async function readPosts() {
	const [sourcePosts, documents] = await Promise.all([readSourcePosts(), listWorkspaceDocuments(workspaceRoot)]);
	const posts = new Map(sourcePosts.map((post) => [post.slug, post]));
	for (const document of documents) {
		let post;
		try {
			post = summarizePost(document.content, document.slug, document.extension);
		} catch (error) {
			post = {
				slug: document.slug, extension: document.extension, title: '需要修复的本地草稿',
				date: '', updated: '', description: '', cover: '', categories: [], tags: [],
				draft: true, validationError: error.message,
			};
		}
		const sourcePost = posts.get(document.slug);
		posts.set(document.slug, {
			...post,
			sourceExists: Boolean(document.sourceExists),
			sourceHash: document.baseHash || '',
			sourceHead: document.baseHead || '',
			localState: document.deleted ? 'deleted' : document.readyToPublish ? 'ready' : 'saved',
			deleted: Boolean(document.deleted),
			readyToPublish: Boolean(document.readyToPublish),
			savedAt: document.savedAt,
			conflict: Boolean(document.sourceExists && sourcePost && sourcePost.sourceHash !== document.baseHash),
		});
	}
	return [...posts.values()].sort((a, b) => (b.date || '').localeCompare(a.date || '', 'zh-CN'));
}

async function currentHead() {
	return git(['rev-parse', 'HEAD']);
}

async function sourceOrWorkspace(slug) {
	const [source, document] = await Promise.all([
		findSourcePost(slug),
		readWorkspaceDocument(workspaceRoot, slug),
	]);
	if (!source && !document) return null;
	const content = document ? document.content : source.content;
	const extension = document ? document.extension : source.extension;
	const parsed = parsePostSource(content);
	const post = { slug, extension, ...parsed.data };
	return {
		post: {
			...post,
			sourceExists: Boolean(document ? document.sourceExists : source),
			localState: document ? (document.deleted ? 'deleted' : 'saved') : 'published',
			deleted: Boolean(document && document.deleted),
			readyToPublish: Boolean(document && document.readyToPublish),
			savedAt: document ? document.savedAt : null,
			conflict: Boolean(document && document.sourceExists && source && source.hash !== document.baseHash),
		},
		content,
		body: parsed.body,
		lineEnding: parsed.lineEnding,
		sourceContent: source ? source.content : null,
		baseContent: document && document.baseContent ? document.baseContent : source ? source.content : null,
		baseBody: document && document.baseContent ? parsePostSource(document.baseContent).body : source ? parsePostSource(source.content).body : '',
		baseHash: document ? document.baseHash : source ? source.hash : '',
		baseHead: document ? document.baseHead : await currentHead(),
		extension,
		document,
		source,
	};
}

async function parseJsonRequest(request) {
	try {
		return JSON.parse(await readBody(request));
	} catch (error) {
		if (error.status) throw error;
		throw Object.assign(new Error('请求格式必须是 JSON。'), { status: 400 });
	}
}

async function savePostWorkspace(request, response, { create = false } = {}) {
	const payload = await parseJsonRequest(request);
	const slug = assertSlug(payload.slug);
	const [source, prior] = await Promise.all([
		findSourcePost(slug),
		readWorkspaceDocument(workspaceRoot, slug),
	]);
	if (create && (source || prior)) return sendJson(response, 409, { error: '这个 slug 已经存在，请选择其他地址。' });
	if (!create && !source && !prior) return sendJson(response, 404, { error: '文章不存在，请刷新列表后重试。' });
	const extension = payload.extension || (prior ? prior.extension : source ? source.extension : 'md');
	if (!['md', 'mdx'].includes(extension)) return sendJson(response, 400, { error: '文章格式只能是 Markdown 或 MDX。' });
	if (source && payload.extension && payload.extension !== source.extension) {
		return sendJson(response, 409, { error: '已发布文章不能直接切换文件格式。' });
	}
	if (typeof payload.body !== 'string' || !payload.metadata || typeof payload.metadata !== 'object') {
		return sendJson(response, 400, { error: '文章内容或字段缺失。' });
	}

	const baseHash = prior ? prior.baseHash : (payload.baseHash || (source ? source.hash : ''));
	const baseHead = prior ? prior.baseHead : (payload.baseHead || await currentHead());
	const baseContent = prior ? prior.baseContent : (source ? source.content : null);
	const lineEnding = prior ? prior.lineEnding : (payload.lineEnding || (source && source.content.includes('\r\n') ? '\r\n' : '\n'));
	let serialized;
	try {
		serialized = serializePostSource({ ...payload.metadata, lineEnding }, payload.body);
	} catch (error) {
		return sendJson(response, error.status || 400, { error: error.message, issues: error.issues || [] });
	}
	if (payload.readyToPublish && serialized.data.draft) return sendJson(response, 400, { error: '加入发布清单前，请取消“保存为草稿”。' });
	const document = {
		slug,
		extension: prior ? prior.extension : source ? source.extension : extension,
		sourceExists: Boolean(prior ? prior.sourceExists : source),
		baseHead,
		baseHash,
		baseContent,
		lineEnding,
		content: serialized.content,
		deleted: false,
		readyToPublish: Boolean(payload.readyToPublish),
		savedAt: new Date().toISOString(),
	};
	await saveWorkspaceDocument(workspaceRoot, document);
	return sendJson(response, 200, {
		ok: true,
		slug,
		post: summarizePost(document.content, slug, document.extension),
		savedAt: document.savedAt,
	});
}

async function deletePostWorkspace(slug) {
	const [source, prior] = await Promise.all([
		findSourcePost(slug),
		readWorkspaceDocument(workspaceRoot, slug),
	]);
	if (!source && !prior) throw Object.assign(new Error('没有找到这篇文章。'), { status: 404 });
	if (!source && prior && !prior.sourceExists) {
		await removeWorkspaceDocument(workspaceRoot, slug);
		return { ok: true, removedLocalDraft: true };
	}
	const content = prior ? prior.content : source.content;
	const document = {
		slug,
		extension: prior ? prior.extension : source.extension,
		sourceExists: true,
		baseHead: prior ? prior.baseHead : await currentHead(),
		baseHash: prior ? prior.baseHash : source.hash,
		baseContent: prior ? prior.baseContent : source.content,
		lineEnding: prior ? prior.lineEnding : (source.content.includes('\r\n') ? '\r\n' : '\n'),
		content,
		deleted: true,
		readyToPublish: false,
		savedAt: new Date().toISOString(),
	};
	await saveWorkspaceDocument(workspaceRoot, document);
	return { ok: true, deleted: true, slug };
}

async function restorePostWorkspace(slug) {
	const document = await readWorkspaceDocument(workspaceRoot, slug);
	if (!document) throw Object.assign(new Error('没有找到本机删除记录。'), { status: 404 });
	if (!document.sourceExists) {
		await removeWorkspaceDocument(workspaceRoot, slug);
		return { ok: true, removedLocalDraft: true };
	}
	if (document.content === document.baseContent) {
		await removeWorkspaceDocument(workspaceRoot, slug);
		return { ok: true, restoredPublishedPost: true, slug };
	}
	document.deleted = false;
	document.readyToPublish = false;
	document.savedAt = new Date().toISOString();
	await saveWorkspaceDocument(workspaceRoot, document);
	return { ok: true, slug };
}

async function routeApi(request, response, url) {
	if (request.method === 'GET' && url.pathname === '/api/health') {
		const [branch, head, headSha, status] = await Promise.all([
			git(['branch', '--show-current']),
			git(['rev-parse', '--short', 'HEAD']),
			git(['rev-parse', 'HEAD']),
			git(['status', '--porcelain=v1']),
		]);
		return sendJson(response, 200, {
			ok: true, branch, head, headSha,
			dirtyCount: status ? status.split('\n').length : 0,
			node: process.version,
		});
	}

	if (request.method === 'GET' && url.pathname === '/api/posts') {
		const posts = await readPosts();
		const workspaceDrafts = posts.filter((post) => ['saved', 'ready', 'deleted'].includes(post.localState)).map((post) => post.slug);
		return sendJson(response, 200, { posts, workspaceDrafts, count: posts.length });
	}

	if (request.method === 'GET' && url.pathname === '/api/settings') {
		return sendJson(response, 200, await readSettingsDocument(workspaceRoot, settingsPath));
	}
	if (request.method === 'PUT' && url.pathname === '/api/workspace/settings') {
		const payload = await parseJsonRequest(request);
		const settings = validateBlogSettings(payload.settings);
		return sendJson(response, 200, { ok: true, ...(await saveSettingsDocument(workspaceRoot, settingsPath, settings, payload.baseHead || await currentHead())) });
	}
	if (request.method === 'POST' && url.pathname === '/api/preview') {
		const payload = await parseJsonRequest(request);
		if (typeof payload.pathname !== 'string') return sendJson(response, 400, { error: '缺少预览页面地址。' });
		return sendJson(response, 200, await previewManager.start(payload.pathname));
	}
	if (request.method === 'GET' && url.pathname === '/api/publish/summary') {
		return sendJson(response, 200, await getPublishSummary({ projectRoot, workspaceRoot, postRoot, settingsPath }));
	}
	if (request.method === 'POST' && url.pathname === '/api/publish') {
		await readBody(request);
		if (publishRun && !publishRun.done) return sendJson(response, 409, { error: '已有发布任务正在运行。' });
		const run = { id: randomUUID(), done: false, phase: 'starting', message: '正在启动发布检查…', result: null, error: false, nextStatusCheck: 0 };
		publishRun = run;
		setImmediate(() => {
			void publishWorkspace({
				projectRoot, workspaceRoot, postRoot, settingsPath,
				onProgress: (phase, message) => { run.phase = phase; run.message = message; },
			}).then((result) => {
				run.result = result;
				run.error = !result.ok;
				run.phase = result.state;
				run.message = result.message;
				run.done = true;
			}).catch((error) => {
				run.error = true;
				run.phase = 'failed';
				run.message = error.message;
				run.done = true;
			});
		});
		return sendJson(response, 202, { id: run.id });
	}
	const publishMatch = url.pathname.match(/^\/api\/publish\/([a-f0-9-]{36})$/);
	if (request.method === 'GET' && publishMatch) {
		if (!publishRun || publishRun.id !== publishMatch[1]) return sendJson(response, 404, { error: '发布记录不存在。' });
		if (publishRun.done && publishRun.result?.ok && publishRun.result.commitSha && Date.now() >= publishRun.nextStatusCheck) {
			publishRun.nextStatusCheck = Date.now() + 10_000;
			publishRun.result.workflow = await getDeploymentStatus(publishRun.result.commitSha, fetch, publishRun.result.slugs || []);
			if (publishRun.result.workflow.state === 'success') publishRun.message = 'GitHub Actions 部署成功。';
			else if (['failure', 'cancelled', 'timed_out'].includes(publishRun.result.workflow.state)) publishRun.message = `GitHub Actions 运行结束：${publishRun.result.workflow.state}。`;
		}
		return sendJson(response, 200, {
			id: publishRun.id, done: publishRun.done, phase: publishRun.phase, message: publishRun.message,
			error: publishRun.error, result: publishRun.result,
		});
	}

	const readMatch = url.pathname.match(/^\/api\/posts\/([a-z0-9-]+)$/);
	if (request.method === 'GET' && readMatch) {
		const slug = assertSlug(readMatch[1]);
		const result = await sourceOrWorkspace(slug);
		if (!result) return sendJson(response, 404, { error: '没有找到这篇文章。' });
		return sendJson(response, 200, result);
	}

	if (request.method === 'POST' && url.pathname === '/api/workspace/post') return savePostWorkspace(request, response, { create: true });
	if (request.method === 'PUT' && url.pathname === '/api/workspace/post') return savePostWorkspace(request, response);

	const deleteMatch = url.pathname.match(/^\/api\/workspace\/post\/([a-z0-9-]+)$/);
	if (request.method === 'DELETE' && deleteMatch) {
		return sendJson(response, 200, await deletePostWorkspace(assertSlug(deleteMatch[1])));
	}
	const restoreMatch = url.pathname.match(/^\/api\/workspace\/post\/([a-z0-9-]+)\/restore$/);
	if (request.method === 'POST' && restoreMatch) {
		return sendJson(response, 200, await restorePostWorkspace(assertSlug(restoreMatch[1])));
	}

	if (request.method === 'POST' && url.pathname === '/api/media') {
		const buffer = await readRawBody(request);
		return sendJson(response, 201, await optimizePrivateImage(workspaceRoot, buffer));
	}

	const mediaMatch = url.pathname.match(/^\/api\/media\/([a-f0-9]{20}\.webp)$/);
	if (request.method === 'GET' && mediaMatch) {
		try {
			const mediaPath = path.join(workspaceRoot, 'media', mediaMatch[1]);
			const { lstat } = await import('node:fs/promises');
			const info = await lstat(mediaPath);
			if (!info.isFile() || info.isSymbolicLink()) return sendJson(response, 404, { error: '本地图片不存在。' });
			return send(response, 200, await readFile(mediaPath), 'image/webp');
		} catch (error) {
			if (error.code === 'ENOENT') return sendJson(response, 404, { error: '本地图片不存在。' });
			throw error;
		}
	}

	return sendJson(response, 404, { error: '找不到该本地 CMS 接口。' });
}

async function handle(request, response) {
	const url = new URL(request.url || '/', `http://${host}:${port}`);
	try {
		assertLocalRequest(request, url, { write: ['PUT', 'POST', 'PATCH', 'DELETE'].includes(request.method) });
		if (url.pathname.startsWith('/api/')) return await routeApi(request, response, url);

		if (request.method === 'GET' && url.pathname === '/') {
			const html = await readFile(path.join(here, 'ui/index.html'), 'utf8');
			return send(response, 200, html.replaceAll('__CMS_SESSION__', sessionToken), 'text/html; charset=utf-8');
		}

		const staticAssets = new Map([
			['/assets/cms.css', path.join(here, 'ui/cms.css')],
			['/assets/app.js', path.join(here, 'ui/app.js')],
			['/theme.css', path.join(projectRoot, 'src/styles/global.css')],
		]);
		if (request.method === 'GET' && staticAssets.has(url.pathname)) {
			const filePath = staticAssets.get(url.pathname);
			return send(response, 200, await readFile(filePath), mimeTypes[path.extname(filePath)] || 'text/css; charset=utf-8');
		}
		return send(response, 404, 'Not found');
	} catch (error) {
		const status = Number.isInteger(error.status) ? error.status : 500;
		if (status === 500) console.error(error);
		if (url.pathname.startsWith('/api/')) return sendJson(response, status, { error: status === 500 ? '本地 CMS 发生错误，请查看终端日志。' : error.message });
		return send(response, status, status === 500 ? '本地 CMS 发生错误，请查看终端日志。' : error.message);
	}
}

const server = createServer((request, response) => void handle(request, response));
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.listen(port, host, () => {
	console.log(`本地 CMS 已启动：http://${host}:${port}/`);
	console.log('该地址只监听当前电脑。按 Ctrl+C 停止。');
});

server.on('error', (error) => {
	if (error.code === 'EADDRINUSE') {
		console.error(`端口 ${port} 已被占用。请停止已有的 CMS，或通过 CMS_PORT 指定其他端口。`);
	} else {
		console.error(error);
	}
	process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		previewManager.cleanupSync();
		server.close(() => process.exit(signal === 'SIGINT' ? 130 : 0));
	});
}
process.on('exit', () => previewManager.cleanupSync());
