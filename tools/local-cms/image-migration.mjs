import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parsePostSource } from './content.mjs';
import { archiveLocalImage } from './media.mjs';
import { findImageReferences, rewriteImageReferences } from './image-references.mjs';
import { saveWorkspaceDocument } from './workspace.mjs';

const managedImage = /^\/?uploads\/blog\/[a-f0-9]{20}\.(?:webp|png|jpe?g|gif|svg|avif)$/i;

async function regularFile(root, relativePath) {
	const absolute = path.resolve(root, relativePath);
	if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return { error: '路径超出项目目录' };
	let cursor = root;
	const parts = path.relative(root, absolute).split(path.sep).filter(Boolean);
	for (let index = 0; index < parts.length; index += 1) {
		cursor = path.join(cursor, parts[index]);
		let info;
		try { info = await lstat(cursor); }
		catch (error) { if (error.code === 'ENOENT') return { missing: true }; throw error; }
		if (info.isSymbolicLink()) return { error: '路径包含符号链接' };
		if (index < parts.length - 1 && !info.isDirectory()) return { error: '路径中的目录不是文件夹' };
		if (index === parts.length - 1 && !info.isFile()) return { error: '路径不是普通文件' };
	}
	return { absolute };
}

function localCandidates(projectRoot, sourcePath, urlPath) {
	const normalized = urlPath.replaceAll('\\', '/').replace(/^\.\//, '');
	if (normalized.startsWith('/')) {
		const relative = normalized.replace(/^\/+/, '');
		return [path.join(projectRoot, 'public', relative), path.join(projectRoot, relative)];
	}
	return [
		path.resolve(projectRoot, path.dirname(sourcePath), normalized),
		path.resolve(projectRoot, 'public', normalized),
		path.resolve(projectRoot, normalized),
	];
}

async function findLocalImage(projectRoot, sourcePath, url) {
	const splitAt = url.search(/[?#]/);
	const urlPath = (splitAt < 0 ? url : url.slice(0, splitAt)).trim();
	const suffix = splitAt < 0 ? '' : url.slice(splitAt);
	let decoded;
	try { decoded = decodeURIComponent(urlPath); }
	catch { return { error: '图片地址包含无效的 URL 编码' }; }
	const candidates = localCandidates(projectRoot, sourcePath, decoded);
	for (const candidate of [...new Set(candidates)]) {
		const result = await regularFile(projectRoot, path.relative(projectRoot, candidate));
		if (result.error) return { error: result.error, candidate };
		if (!result.missing) return { absolute: result.absolute, suffix };
	}
	return { missing: true, checked: candidates.map((candidate) => path.relative(projectRoot, candidate)) };
}

async function managedImageExists(projectRoot, workspaceRoot, url) {
	const relative = url.replace(/^\/+/, '');
	const privatePath = path.join(workspaceRoot, 'media', path.basename(relative));
	const publicPath = path.join(projectRoot, 'public', relative);
	for (const candidate of [privatePath, publicPath]) {
		try {
			const info = await lstat(candidate);
			if (info.isSymbolicLink() || !info.isFile()) continue;
			return true;
		} catch (error) {
			if (error.code !== 'ENOENT') throw error;
		}
	}
	return false;
}

export async function migrateSelectedPostImages(options, selected) {
	const { projectRoot, workspaceRoot } = options;
	const blockers = [];
	const migrations = [];
	const archivedBySource = new Map();
	for (const item of selected.filter((entry) => entry.action === 'write')) {
		const document = item.document;
		const title = (() => { try { return parsePostSource(document.content).data.title; } catch { return document.slug; } })();
		let references;
		try { references = findImageReferences(document.content); }
		catch (error) {
			blockers.push(`文章「${title}」(${document.slug}) 的图片引用无法解析：${error.message}`);
			continue;
		}
		const replacements = [];
		let changed = false;
		for (const reference of references) {
			if (reference.url === null) {
				blockers.push(`文章「${title}」(${document.slug}) 第 ${reference.line} 行的图片引用不是固定本地路径，请改为明确路径后再发布。`);
				replacements.push(null);
				continue;
			}
			const url = reference.url.trim();
			if (!url || /^data:image\//i.test(url)) {
				replacements.push(null);
				continue;
			}
			if (/^(?:https?:)?\/\//i.test(url) || /^[a-z][a-z\d+.-]*:/i.test(url)) {
				blockers.push(`文章「${title}」(${document.slug}) 第 ${reference.line} 行引用了外部图片「${url}」。请先用 CMS 上传并替换为本地图片，避免依赖外站地址。`);
				replacements.push(null);
				continue;
			}
			if (managedImage.test(url)) {
				if (!await managedImageExists(projectRoot, workspaceRoot, url)) {
					blockers.push(`文章「${title}」(${document.slug}) 第 ${reference.line} 行的图片「${url}」在统一媒体库和 public 目录中都不存在。`);
				}
				replacements.push(null);
				continue;
			}
			const found = await findLocalImage(projectRoot, item.relativePath, url);
			if (found.error) {
				blockers.push(`文章「${title}」(${document.slug}) 第 ${reference.line} 行的图片「${url}」无法安全读取：${found.error}。`);
				replacements.push(null);
				continue;
			}
			if (found.missing) {
				blockers.push(`文章「${title}」(${document.slug}) 第 ${reference.line} 行找不到图片「${url}」；已检查：${found.checked.join('、')}。`);
				replacements.push(null);
				continue;
			}
			let archived = archivedBySource.get(found.absolute);
			if (!archived) {
				try {
					archived = await archiveLocalImage(workspaceRoot, await readFile(found.absolute));
					archivedBySource.set(found.absolute, archived);
				} catch (error) {
					blockers.push(`文章「${title}」(${document.slug}) 第 ${reference.line} 行的图片「${url}」无法归档：${error.message}`);
					replacements.push(null);
					continue;
				}
			}
			const nextUrl = `${archived.path}${found.suffix}`;
			replacements.push(nextUrl);
			if (nextUrl !== url) {
				changed = true;
				migrations.push({ slug: document.slug, title, from: url, to: nextUrl });
			}
		}
		if (changed) {
			document.content = rewriteImageReferences(document.content, references, replacements);
			document.savedAt = new Date().toISOString();
			await saveWorkspaceDocument(workspaceRoot, document);
		}
	}
	return { blockers, migrations };
}

