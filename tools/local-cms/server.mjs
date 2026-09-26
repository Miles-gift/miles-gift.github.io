#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const workspaceRoot = path.join(projectRoot, '.local-cms');
const postRoot = path.join(projectRoot, 'src/content/blog');
const host = '127.0.0.1';
const port = Number(process.env.CMS_PORT || 4178);
const sessionToken = randomBytes(32).toString('base64url');
const sessionHeader = 'x-cms-session';
const maxBodyBytes = 5 * 1024 * 1024;
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

async function readBody(request) {
	const chunks = [];
	let size = 0;
	for await (const chunk of request) {
		size += chunk.length;
		if (size > maxBodyBytes) throw Object.assign(new Error('请求内容超过 5 MB。'), { status: 413 });
		chunks.push(chunk);
	}
	return Buffer.concat(chunks).toString('utf8');
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

function frontmatterBlock(source) {
	const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	return match?.[1] ?? '';
}

function simpleField(frontmatter, name) {
	const match = frontmatter.match(new RegExp(`^${name}:\\s*(?:"([^"]*)"|'([^']*)'|([^\\r\\n]*))\\s*$`, 'm'));
	return match?.[1] ?? match?.[2] ?? match?.[3]?.trim() ?? '';
}

function yamlList(frontmatter, name) {
	const block = frontmatter.match(new RegExp(`^${name}:\\s*\\r?\\n((?:[ \\t]+-[^\\r\\n]*\\r?\\n?)*)`, 'm'))?.[1];
	if (!block) return [];
	return [...block.matchAll(/^\s+-\s*["']?(.*?)["']?\s*$/gm)].map((match) => match[1]);
}

async function readPosts() {
	const entries = await readdir(postRoot, { withFileTypes: true });
	const posts = [];
	for (const entry of entries) {
		if (!entry.isFile() || !/\.(md|mdx)$/i.test(entry.name)) continue;
		const slug = entry.name.replace(/\.(md|mdx)$/i, '');
		const content = await readFile(path.join(postRoot, entry.name), 'utf8');
		const frontmatter = frontmatterBlock(content);
		posts.push({
			slug,
			extension: path.extname(entry.name).slice(1),
			title: simpleField(frontmatter, 'title') || '未命名文章',
			date: simpleField(frontmatter, 'date'),
			updated: simpleField(frontmatter, 'updated'),
			category: yamlList(frontmatter, 'categories')[0] || '',
			tags: yamlList(frontmatter, 'tags'),
			draft: simpleField(frontmatter, 'draft') === 'true',
		});
	}
	return posts.sort((a, b) => b.date.localeCompare(a.date, 'zh-CN'));
}

async function listWorkspaceDrafts() {
	const directory = path.join(workspaceRoot, 'drafts');
	try {
		const names = await readdir(directory);
		return names.filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5));
	} catch (error) {
		if (error.code === 'ENOENT') return [];
		throw error;
	}
}

async function routeApi(request, response, url) {
	if (request.method === 'GET' && url.pathname === '/api/health') {
		const [branch, head, status] = await Promise.all([
			git(['branch', '--show-current']),
			git(['rev-parse', '--short', 'HEAD']),
			git(['status', '--porcelain=v1']),
		]);
		return sendJson(response, 200, { ok: true, branch, head, dirtyCount: status ? status.split('\n').length : 0, node: process.version });
	}

	if (request.method === 'GET' && url.pathname === '/api/posts') {
		const [posts, drafts] = await Promise.all([readPosts(), listWorkspaceDrafts()]);
		return sendJson(response, 200, { posts, workspaceDrafts: drafts, count: posts.length });
	}

	const readMatch = url.pathname.match(/^\/api\/posts\/([a-z0-9-]+)$/);
	if (request.method === 'GET' && readMatch) {
		const slug = assertSlug(readMatch[1]);
		const existing = (await readPosts()).find((post) => post.slug === slug);
		if (!existing) return sendJson(response, 404, { error: '没有找到这篇文章。' });
		const content = await readFile(path.join(postRoot, `${slug}.${existing.extension}`), 'utf8');
		return sendJson(response, 200, { post: existing, content });
	}

	if (request.method === 'PUT' && url.pathname === '/api/workspace/post') {
		const raw = await readBody(request);
		let payload;
		try {
			payload = JSON.parse(raw);
		} catch {
			return sendJson(response, 400, { error: '请求格式必须是 JSON。' });
		}
		const slug = assertSlug(payload.slug);
		if (!['md', 'mdx'].includes(payload.extension) || typeof payload.content !== 'string') {
			return sendJson(response, 400, { error: '需要有效的文章格式和文本内容。' });
		}
		if (!payload.content.startsWith('---')) return sendJson(response, 400, { error: '文章必须包含 YAML frontmatter。' });
		const draftsRoot = path.join(workspaceRoot, 'drafts');
		await mkdir(draftsRoot, { recursive: true });
		const target = path.join(draftsRoot, `${slug}.json`);
		const temporary = `${target}.${process.pid}.tmp`;
		const document = {
			version: 1,
			slug,
			extension: payload.extension,
			baseHead: typeof payload.baseHead === 'string' ? payload.baseHead.slice(0, 80) : '',
			baseHash: typeof payload.baseHash === 'string' ? payload.baseHash.slice(0, 128) : '',
			savedAt: new Date().toISOString(),
			content: payload.content,
		};
		await writeFile(temporary, JSON.stringify(document, null, 2), { encoding: 'utf8', mode: 0o600 });
		await rename(temporary, target);
		return sendJson(response, 200, { ok: true, slug, savedAt: document.savedAt });
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
