import { lstat, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const draftsDirectory = (workspaceRoot) => path.join(workspaceRoot, 'drafts');

async function prepareDirectory(workspaceRoot) {
	const directory = draftsDirectory(workspaceRoot);
	await mkdir(workspaceRoot, { recursive: true, mode: 0o700 });
	const rootInfo = await lstat(workspaceRoot);
	if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('本地工作区路径不能是符号链接或普通文件。');
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const draftsInfo = await lstat(directory);
	if (!draftsInfo.isDirectory() || draftsInfo.isSymbolicLink()) throw new Error('本地工作区路径不能是符号链接或普通文件。');
}

function fileFor(workspaceRoot, slug) {
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
		throw Object.assign(new Error('slug 只能使用小写英文、数字和单个连字符。'), { status: 400 });
	}
	return path.join(draftsDirectory(workspaceRoot), `${slug}.json`);
}

export async function readWorkspaceDocument(workspaceRoot, slug) {
	const filePath = fileFor(workspaceRoot, slug);
	try {
		const rootInfo = await lstat(workspaceRoot);
		const directoryInfo = await lstat(draftsDirectory(workspaceRoot));
		if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || !directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
			throw new Error('本地工作区路径不能是符号链接或普通文件。');
		}
		const info = await lstat(filePath);
		if (!info.isFile() || info.isSymbolicLink()) throw new Error(`本地草稿 ${slug} 不是普通文件。`);
		const document = JSON.parse(await readFile(filePath, 'utf8'));
		if (document.version !== 1 || document.slug !== slug || typeof document.content !== 'string') {
			throw new Error(`本地草稿 ${slug} 的格式无效。`);
		}
		return document;
	} catch (error) {
		if (error.code === 'ENOENT') return null;
		throw error;
	}
}

export async function listWorkspaceDocuments(workspaceRoot) {
	const directory = draftsDirectory(workspaceRoot);
	try {
		const rootInfo = await lstat(workspaceRoot);
		const directoryInfo = await lstat(directory);
		if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || !directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
			throw new Error('本地工作区路径不能是符号链接或普通文件。');
		}
		const names = await readdir(directory);
		const documents = [];
		for (const name of names.filter((item) => item.endsWith('.json'))) {
			const slug = name.slice(0, -5);
			const document = await readWorkspaceDocument(workspaceRoot, slug);
			if (document) documents.push(document);
		}
		return documents;
	} catch (error) {
		if (error.code === 'ENOENT') return [];
		throw error;
	}
}

export async function saveWorkspaceDocument(workspaceRoot, document) {
	await prepareDirectory(workspaceRoot);
	const target = fileFor(workspaceRoot, document.slug);
	const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
	try {
		const info = await lstat(target);
		if (!info.isFile() || info.isSymbolicLink()) throw new Error('拒绝写入非普通草稿文件。');
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
	}
	await writeFile(temporary, JSON.stringify({ version: 1, ...document }, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
	await rename(temporary, target);
	return document;
}

export async function removeWorkspaceDocument(workspaceRoot, slug) {
	const target = fileFor(workspaceRoot, slug);
	try {
		await rm(target, { force: true });
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
	}
}
