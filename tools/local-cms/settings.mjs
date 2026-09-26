import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const settingKeys = [
	'siteTitle', 'siteDescription', 'blogHero', 'archiveTitle', 'archiveIntro',
	'emptyArchiveIntro', 'emptyListMessage', 'defaultPostHero',
];

function fail(message) {
	throw Object.assign(new Error(message), { status: 400 });
}

export function validateBlogSettings(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) fail('博客设置格式不正确。');
	const extra = Object.keys(input).filter((key) => !settingKeys.includes(key));
	if (extra.length) fail(`博客设置包含未知字段：${extra.join('、')}`);
	const text = (key, max, candidate = input[key]) => {
		const value = candidate;
		if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) fail(`${key} 不能为空且不能超过 ${max} 个字符。`);
		return value.trim();
	};
	if (!input.blogHero || typeof input.blogHero !== 'object' || Array.isArray(input.blogHero)) fail('博客 Hero 设置格式不正确。');
	const allowedHero = ['title', 'subtitle', 'backgroundImage'];
	if (Object.keys(input.blogHero).some((key) => !allowedHero.includes(key))) fail('博客 Hero 设置包含未知字段。');
	const background = (value, label) => {
		if (typeof value !== 'string') fail(`${label} 必须是图片路径。`);
		const clean = value.trim();
		if (clean && (!clean.startsWith('/') || clean.startsWith('//') || clean.split('/').includes('..') || !/^\/(uploads\/blog|illustrations|image)\/[\w./%\u0080-\uFFFF-]+$/.test(clean))) {
			fail(`${label} 只接受站内图片路径。`);
		}
		return clean;
	};
	const archiveIntro = text('archiveIntro', 260);
	for (const match of archiveIntro.matchAll(/\{([^}]+)\}/g)) {
		if (!['total', 'current', 'last'].includes(match[1])) fail('归档介绍只允许 {total}、{current}、{last} 占位符。');
	}
	return {
		siteTitle: text('siteTitle', 80),
		siteDescription: text('siteDescription', 320),
		blogHero: {
			title: text('blogHero.title', 120, input.blogHero.title),
			subtitle: text('blogHero.subtitle', 240, input.blogHero.subtitle),
			backgroundImage: background(input.blogHero.backgroundImage, '博客 Hero 背景'),
		},
		archiveTitle: text('archiveTitle', 120),
		archiveIntro,
		emptyArchiveIntro: text('emptyArchiveIntro', 260),
		emptyListMessage: text('emptyListMessage', 260),
		defaultPostHero: background(input.defaultPostHero, '默认文章 Hero 背景'),
	};
}

export function hashSettings(content) {
	return createHash('sha256').update(content).digest('hex');
}

async function ensurePrivateDirectory(workspaceRoot) {
	await mkdir(workspaceRoot, { recursive: true, mode: 0o700 });
	const info = await lstat(workspaceRoot);
	if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('本地工作区不能是符号链接或普通文件。');
}

export async function readSettingsDocument(workspaceRoot, sourcePath) {
	const sourceContent = await readFile(sourcePath, 'utf8');
	const sourceSettings = validateBlogSettings(JSON.parse(sourceContent));
	const privatePath = path.join(workspaceRoot, 'blog-settings.json');
	try {
		const rootInfo = await lstat(workspaceRoot);
		if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('本地工作区不能是符号链接或普通文件。');
		const info = await lstat(privatePath);
		if (!info.isFile() || info.isSymbolicLink()) throw new Error('本地设置文件必须是普通文件。');
		const document = JSON.parse(await readFile(privatePath, 'utf8'));
		const settings = validateBlogSettings(document.settings);
		return {
			settings,
			baseSettings: document.baseSettings || sourceSettings,
			baseHash: document.baseHash || hashSettings(sourceContent),
			baseContent: document.baseContent || sourceContent,
			baseHead: document.baseHead || '',
			savedAt: document.savedAt || null,
			local: true,
		};
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
		return {
			settings: sourceSettings,
			baseSettings: sourceSettings,
			baseHash: hashSettings(sourceContent),
			baseContent: sourceContent,
			baseHead: '',
			savedAt: null,
			local: false,
		};
	}
}

export async function saveSettingsDocument(workspaceRoot, sourcePath, settings, baseHead) {
	await ensurePrivateDirectory(workspaceRoot);
	const current = await readSettingsDocument(workspaceRoot, sourcePath);
	const sourceContent = await readFile(sourcePath, 'utf8');
	const document = {
		version: 1,
		settings: validateBlogSettings(settings),
		baseSettings: current.baseSettings,
		baseHash: current.baseHash,
		baseContent: current.baseContent,
		baseHead: current.baseHead || baseHead || '',
		savedAt: new Date().toISOString(),
	};
	const target = path.join(workspaceRoot, 'blog-settings.json');
	const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
	await writeFile(temporary, JSON.stringify(document, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
	await rename(temporary, target);
	return { ...document, local: true, baseSettings: document.baseSettings, sourceChanged: hashSettings(sourceContent) !== document.baseHash };
}
