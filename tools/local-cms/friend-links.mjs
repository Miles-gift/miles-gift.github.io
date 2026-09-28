import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const defaults = { version: 1, links: [] };
const hash = (value) => createHash('sha256').update(value).digest('hex');

function fail(message) {
	throw Object.assign(new Error(message), { status: 400 });
}

export function validateFriendLinks(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 1 || !Array.isArray(input.links)) fail('友联数据格式不正确。');
	if (Object.keys(input).some((key) => !['version', 'links'].includes(key))) fail('友联数据包含未知字段。');
	if (input.links.length > 100) fail('友联最多支持 100 条。');
	const ids = new Set();
	const urls = new Set();
	return {
		version: 1,
		links: input.links.map((entry, index) => {
			const label = `第 ${index + 1} 条友联`;
			if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail(`${label}格式不正确。`);
			if (Object.keys(entry).some((key) => !['id', 'name', 'url', 'description', 'enabled'].includes(key))) fail(`${label}包含未知字段。`);
			const id = typeof entry.id === 'string' ? entry.id.trim() : '';
			const name = typeof entry.name === 'string' ? entry.name.trim() : '';
			const urlText = typeof entry.url === 'string' ? entry.url.trim() : '';
			const description = typeof entry.description === 'string' ? entry.description.trim() : '';
			if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) fail(`${label}的内部标识无效或重复。`);
			if (!name || name.length > 60) fail(`${label}名称必填且不能超过 60 个字符。`);
			if (!urlText || urlText.length > 2048) fail(`${label}网址必填且不能超过 2048 个字符。`);
			if (description.length > 160) fail(`${label}简介不能超过 160 个字符。`);
			let url;
			try { url = new URL(urlText); } catch { fail(`${label}网址格式不正确。`); }
			if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail(`${label}只接受不含账号信息的 HTTP 或 HTTPS 网址。`);
			const normalizedUrl = url.toString();
			const comparable = `${url.protocol}//${url.host}${url.pathname}${url.search}${url.hash}`;
			if (urls.has(comparable)) fail(`${label}网址与其他友联重复。`);
			if (typeof entry.enabled !== 'boolean') fail(`${label}的显示状态无效。`);
			ids.add(id);
			urls.add(comparable);
			return { id, name, url: normalizedUrl, description, enabled: entry.enabled };
		}),
	};
}

async function regularDirectory(directory) {
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const info = await lstat(directory);
	if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('本机 CMS 工作区必须是普通目录。');
}

export async function readFriendLinksDocument(workspaceRoot, sourcePath) {
	const sourceContent = await readFile(sourcePath, 'utf8');
	const source = validateFriendLinks(JSON.parse(sourceContent));
	const privatePath = path.join(workspaceRoot, 'friend-links.json');
	try {
		const rootInfo = await lstat(workspaceRoot);
		if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('本机 CMS 工作区必须是普通目录。');
		const info = await lstat(privatePath);
		if (!info.isFile() || info.isSymbolicLink()) throw new Error('本机友联文件必须是普通文件。');
		const document = JSON.parse(await readFile(privatePath, 'utf8'));
		const data = validateFriendLinks(document.data);
		return { data, baseData: validateFriendLinks(document.baseData), baseHash: document.baseHash, revision: document.revision, savedAt: document.savedAt, local: true, sourceChanged: hash(sourceContent) !== document.baseHash };
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
		return { data: source, baseData: source, baseHash: hash(sourceContent), revision: 'source', savedAt: null, local: false, sourceChanged: false };
	}
}

export async function saveFriendLinksDocument(workspaceRoot, sourcePath, data, expectedRevision) {
	await regularDirectory(workspaceRoot);
	const current = await readFriendLinksDocument(workspaceRoot, sourcePath);
	if (current.revision !== expectedRevision) throw Object.assign(new Error('友联数据已在另一个页面中更新，请重新读取后再保存。'), { status: 409 });
	if (current.sourceChanged) throw Object.assign(new Error('公开友联文件已变化，请先重新读取以解决版本冲突。'), { status: 409 });
	const sourceContent = await readFile(sourcePath, 'utf8');
	const document = {
		version: 1,
		data: validateFriendLinks(data),
		baseData: current.baseData,
		baseHash: current.baseHash,
		revision: randomUUID(),
		savedAt: new Date().toISOString(),
	};
	const target = path.join(workspaceRoot, 'friend-links.json');
	const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
	await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
	await rename(temporary, target);
	return { ...document, local: true, sourceChanged: hash(sourceContent) !== document.baseHash };
}

export { defaults as emptyFriendLinks };
