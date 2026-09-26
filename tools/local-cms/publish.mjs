import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { hashContent, parsePostSource, serializePostSource } from './content.mjs';
import { readSettingsDocument, hashSettings } from './settings.mjs';
import { listWorkspaceDocuments, removeWorkspaceDocument, saveWorkspaceDocument } from './workspace.mjs';
import { migrateSelectedPostImages } from './image-migration.mjs';

const defaultRemote = 'https://github.com/Miles-gift/miles-gift.github.io.git';
const trackedBranch = 'main';
const execFileAsync = promisify(execFile);

async function command(args, cwd, options = {}) {
	try {
		const { stdout } = await execFileAsync('git', args, { cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, ...options });
		return stdout.trim();
	} catch (error) {
		const details = String(error.stderr || error.message || '').trim().split('\n').slice(-8).join('\n');
		throw new Error(`git ${args.join(' ')} 失败${details ? `：\n${details}` : ''}`);
	}
}

async function statusOutput(cwd) {
	try {
		const { stdout } = await execFileAsync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
			cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
		});
		return stdout.replace(/\n+$/, '');
	} catch (error) {
		const details = String(error.stderr || error.message || '').trim();
		throw new Error(`git status 失败${details ? `：${details}` : ''}`);
	}
}

function sameRemote(actual, expected) {
	const normalize = (value) => value
		.replace(/^git@github\.com:/i, 'https://github.com/')
		.replace(/^ssh:\/\/git@github\.com\//i, 'https://github.com/')
		.replace(/\.git$/i, '')
		.replace(/\/$/, '')
		.toLowerCase();
	return normalize(actual) === normalize(expected);
}

function safeSlug(slug) {
	return typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 100;
}

async function safeLstat(filePath) {
	try { return await lstat(filePath); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function assertSafePath(root, relativePath, { allowMissing = true } = {}) {
	const absolute = path.resolve(root, relativePath);
	if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) throw new Error('拒绝访问 CMS 管理目录之外的路径。');
	let cursor = root;
	const parts = path.relative(root, absolute).split(path.sep).filter(Boolean);
	for (let index = 0; index < parts.length; index += 1) {
		cursor = path.join(cursor, parts[index]);
		const info = await safeLstat(cursor);
		if (!info) {
			if (allowMissing) return absolute;
			throw new Error(`发布文件不存在：${relativePath}`);
		}
		if (info.isSymbolicLink()) throw new Error(`发布路径包含符号链接：${relativePath}`);
		if (index < parts.length - 1 && !info.isDirectory()) throw new Error(`发布路径不是目录：${relativePath}`);
	}
	return absolute;
}

async function sourceFiles(postRoot, slug) {
	const matches = [];
	for (const extension of ['md', 'mdx']) {
		const filePath = path.join(postRoot, `${slug}.${extension}`);
		const info = await safeLstat(filePath);
		if (info) {
			if (!info.isFile() || info.isSymbolicLink()) throw new Error(`文章文件不是普通文件：${slug}.${extension}`);
			matches.push({ extension, filePath, content: await readFile(filePath, 'utf8') });
		}
	}
	if (matches.length > 1) throw new Error(`slug ${slug} 同时存在 Markdown 与 MDX 文件。`);
	return matches[0] || null;
}

function collectMediaPaths(content) {
	const paths = new Set();
	for (const match of content.matchAll(/\/uploads\/blog\/([^\s)"'?#<>]+)/g)) {
		if (!/^[a-f0-9]{20}\.(?:webp|png|jpe?g|gif|svg|avif)$/i.test(match[1])) throw new Error(`发现无效的本机上传图片路径：${match[0]}`);
		paths.add(match[1]);
	}
	return [...paths];
}

async function inspectWorkspace({ projectRoot, workspaceRoot, postRoot, settingsPath, expectedRemote = defaultRemote }) {
	const blockers = [];
	for (const relative of ['src/content/blog', 'src/data/blog-settings.json']) {
		try { await assertSafePath(projectRoot, relative); }
		catch (error) { blockers.push(error.message); }
	}
	const branch = await command(['branch', '--show-current'], projectRoot);
	const remoteUrl = await command(['remote', 'get-url', 'origin'], projectRoot);
	const status = await statusOutput(projectRoot);
	let ahead = 0;
	let behind = 0;
	try { [ahead, behind] = (await command(['rev-list', '--left-right', '--count', 'main...origin/main'], projectRoot)).split(/\s+/).map(Number); }
	catch { blockers.push('尚未读取到 origin/main；发布前需要先连接 GitHub 并同步远端。'); }
	if (branch !== trackedBranch) blockers.push(`当前分支是 ${branch || '（未命名）'}；发布只允许从 main 进入 origin/main。`);
	if (!sameRemote(remoteUrl, expectedRemote)) blockers.push('origin 不是计划中的 Miles-gift/miles-gift.github.io GitHub 仓库。');
	if (ahead > 0) blockers.push('本地 main 有尚未推送的提交；请先处理这些提交，CMS 不会自动重放或强推。');
	if (behind > 0) blockers.push('本地 main 落后于 origin/main；一键发布会先尝试安全快进同步。');
	if (status) blockers.push('Git 工作区有未提交改动；请先提交或处理这些改动，再运行 CMS 发布。');

	const documents = await listWorkspaceDocuments(workspaceRoot);
	const changes = [];
	const selected = [];
	const media = new Set();
	for (const document of documents) {
		if (!document.deleted && !document.readyToPublish) continue;
		if (!safeSlug(document.slug)) {
			blockers.push(`文章 slug 不安全：${document.slug}`);
			continue;
		}
		const source = await sourceFiles(postRoot, document.slug);
		if (document.deleted) {
			if (!document.sourceExists) continue;
			if (!source || source.extension !== document.extension || hashContent(source.content) !== document.baseHash) {
				blockers.push(`文章 ${document.slug} 的源文件已变化，删除操作与当前版本冲突。`);
				continue;
			}
			selected.push({ document, source, action: 'delete', relativePath: `src/content/blog/${document.slug}.${document.extension}` });
			changes.push({ type: '删除文章', title: document.slug, path: `src/content/blog/${document.slug}.${document.extension}` });
			continue;
		}
		if (!document.sourceExists && source) {
			blockers.push(`新文章 ${document.slug} 已在源目录中出现，请先处理重复 slug。`);
			continue;
		}
		if (document.sourceExists && (!source || source.extension !== document.extension || hashContent(source.content) !== document.baseHash)) {
			blockers.push(`文章 ${document.slug} 的源文件已变化，请重新打开文章并解决版本冲突。`);
			continue;
		}
		if (document.sourceExists && hashContent(source.content) === hashContent(document.content)) continue;
		const parsed = parsePostSource(document.content);
		if (parsed.data.draft === true) {
			blockers.push(`文章 ${document.slug} 仍是草稿，不能加入公开发布。`);
			continue;
		}
		const relativePath = `src/content/blog/${document.slug}.${document.extension}`;
		selected.push({ document, source, action: 'write', relativePath });
		changes.push({ type: document.sourceExists ? '更新文章' : '新增文章', title: parsed.data.title || document.slug, path: relativePath });
		for (const filename of collectMediaPaths(document.content)) media.add(filename);
	}

	const settingsDocument = await readSettingsDocument(workspaceRoot, settingsPath);
	let settingsChange = null;
	if (settingsDocument.local && JSON.stringify(settingsDocument.settings) !== JSON.stringify(settingsDocument.baseSettings)) {
		const sourceHash = hashSettings(await readFile(settingsPath, 'utf8'));
		if (sourceHash !== settingsDocument.baseHash) blockers.push('博客设置源文件已变化，请重新读取并解决版本冲突。');
		else {
			settingsChange = { type: '更新博客设置', path: 'src/data/blog-settings.json' };
			changes.push(settingsChange);
		}
	}
	if (settingsDocument.local) for (const filename of collectMediaPaths(JSON.stringify(settingsDocument.settings))) media.add(filename);

	for (const filename of media) {
		const publicPath = path.join(projectRoot, 'public/uploads/blog', filename);
		const privatePath = path.join(workspaceRoot, 'media', filename);
		try { await assertSafePath(projectRoot, `public/uploads/blog/${filename}`); }
		catch (error) { blockers.push(error.message); continue; }
		const existing = await safeLstat(publicPath);
		if (existing) {
			if (!existing.isFile() || existing.isSymbolicLink()) blockers.push(`公开媒体不是普通文件：${filename}`);
			else {
				const privateInfo = await safeLstat(privatePath);
				if (!privateInfo) continue;
				if (hashContent(await readFile(publicPath)) === hashContent(await readFile(privatePath))) continue;
				blockers.push(`公开媒体文件名已被占用：${filename}`);
			}
			continue;
		}
		const privateInfo = await safeLstat(privatePath);
		if (!privateInfo || !privateInfo.isFile() || privateInfo.isSymbolicLink()) blockers.push(`找不到文章引用的本机图片：${filename}`);
		else {
			changes.push({ type: '新增图片', title: filename, path: `public/uploads/blog/${filename}` });
		}
	}
	return { branch, remoteUrl, status, blockers, changes, selected, settingsDocument, settingsChange, media: [...media] };
}

async function normalizeSelectedPostDocuments(workspaceRoot, selected) {
	let changed = false;
	for (const item of selected) {
		if (item.action !== 'write') continue;
		const parsed = parsePostSource(item.document.content);
		const normalized = serializePostSource(
			{ ...parsed.data, lineEnding: parsed.lineEnding },
			parsed.body,
		).content;
		if (normalized === item.document.content) continue;
		item.document.content = normalized;
		item.document.savedAt = new Date().toISOString();
		await saveWorkspaceDocument(workspaceRoot, item.document);
		changed = true;
	}
	return changed;
}

export async function getPublishSummary(options) {
	let inspection = await inspectWorkspace(options);
	let imageMigration = { blockers: [], migrations: [] };
	if (inspection.blockers.length === 0) {
		const contentNormalized = await normalizeSelectedPostDocuments(options.workspaceRoot, inspection.selected);
		imageMigration = await migrateSelectedPostImages(options, inspection.selected);
		if (contentNormalized || imageMigration.migrations.length > 0) inspection = await inspectWorkspace(options);
	}
	const blockers = [...inspection.blockers, ...imageMigration.blockers];
	return {
		branch: inspection.branch,
		target: 'origin/main',
		canPublish: blockers.length === 0 && inspection.changes.length > 0,
		blockers,
		changes: inspection.changes,
		changeCount: inspection.changes.length,
		imageMigrations: imageMigration.migrations,
	};
}

async function publishCommand(commandName, args, cwd) {
	try {
		const { stdout } = await execFileAsync(commandName, args, { cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
		return stdout.trim();
	} catch (error) {
		const details = String(error.stderr || error.stdout || error.message || '').trim().split('\n').slice(-12).join('\n');
		throw new Error(`${commandName} ${args.join(' ')} 失败${details ? `：\n${details}` : ''}`);
	}
}

async function prepareBackup(projectRoot, workspaceRoot, relativePaths) {
	const backupRoot = path.join(workspaceRoot, 'backups', `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
	await mkdir(backupRoot, { recursive: true, mode: 0o700 });
	const manifest = [];
	for (const relativePath of relativePaths) {
		const source = await assertSafePath(projectRoot, relativePath);
		const info = await safeLstat(source);
		if (!info) { manifest.push({ relativePath, existed: false }); continue; }
		if (!info.isFile() || info.isSymbolicLink()) throw new Error(`备份目标不是普通文件：${relativePath}`);
		const destination = path.join(backupRoot, 'files', relativePath);
		await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
		await copyFile(source, destination);
		manifest.push({ relativePath, existed: true });
	}
	await writeFile(path.join(backupRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
	return backupRoot;
}

async function atomicWrite(filePath, content) {
	await mkdir(path.dirname(filePath), { recursive: true });
	const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
	try {
		await writeFile(temporary, content, { flag: 'wx', mode: 0o644 });
		await rename(temporary, filePath);
	} catch (error) {
		await rm(temporary, { force: true });
		throw error;
	}
}

async function restoreBackup(projectRoot, backupRoot, appliedCurrent) {
	const manifest = JSON.parse(await readFile(path.join(backupRoot, 'manifest.json'), 'utf8'));
	const conflicts = [];
	for (const item of manifest) {
		if (!appliedCurrent.has(item.relativePath)) continue;
		const target = await assertSafePath(projectRoot, item.relativePath);
		const current = await safeLstat(target);
		const expectedHash = appliedCurrent.get(item.relativePath);
		const matchesApplied = expectedHash === null
			? !current
			: Boolean(current?.isFile() && !current.isSymbolicLink() && hashContent(await readFile(target)) === expectedHash);
		if (!matchesApplied) {
			conflicts.push(item.relativePath);
			continue;
		}
		if (!item.existed) {
			await rm(target, { force: true });
			continue;
		}
		const backup = path.join(backupRoot, 'files', item.relativePath);
		await atomicWrite(target, await readFile(backup));
	}
	return conflicts;
}

async function runChecks(projectRoot, onProgress, checkRunner = publishCommand) {
	const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
	for (const args of [
		['run', 'frontmatter:check'],
		['run', 'check'],
		['test'],
		['run', 'build'],
	]) {
		onProgress?.('checking', `运行 npm ${args.join(' ')}…`);
		try {
			await checkRunner(npm, args, projectRoot);
		} catch (error) {
			throw new Error(`预发布检查 npm ${args.join(' ')} 失败：${String(error.stderr || error.message).trim().slice(-2400)}`);
		}
		onProgress?.('checking', `npm ${args.join(' ')} 通过。`);
	}
}

async function archiveWorkspace(workspaceRoot, selected, settingsDocument, commitSha) {
	const archiveRoot = path.join(workspaceRoot, 'archive', commitSha.slice(0, 12));
	await mkdir(archiveRoot, { recursive: true, mode: 0o700 });
	for (const { document } of selected) {
		const source = path.join(workspaceRoot, 'drafts', `${document.slug}.json`);
		const target = path.join(archiveRoot, 'drafts', `${document.slug}.json`);
		await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
		await copyFile(source, target);
		await removeWorkspaceDocument(workspaceRoot, document.slug);
	}
	if (settingsDocument.local) {
		const source = path.join(workspaceRoot, 'blog-settings.json');
		const target = path.join(archiveRoot, 'blog-settings.json');
		await copyFile(source, target);
		await rm(source, { force: true });
	}
	await writeFile(path.join(archiveRoot, 'commit.txt'), `${commitSha}\n`, { mode: 0o600 });
}

export async function getDeploymentStatus(commitSha, fetchImpl = fetch, publishedSlugs = []) {
	const workflowUrl = 'https://github.com/Miles-gift/miles-gift.github.io/actions';
	try {
		const response = await fetchImpl(`https://api.github.com/repos/Miles-gift/miles-gift.github.io/actions/runs?head_sha=${encodeURIComponent(commitSha)}&per_page=10`, {
			headers: { accept: 'application/vnd.github+json', 'user-agent': 'ulbo-local-cms' },
			signal: AbortSignal.timeout(4000),
		});
		if (!response.ok) return { state: 'unknown', message: `GitHub Actions 状态暂不可读（HTTP ${response.status}）。`, workflowUrl };
		const data = await response.json();
		const run = data.workflow_runs?.find((item) => item.head_sha === commitSha && item.path === '.github/workflows/deploy.yml');
		if (!run) return { state: 'waiting', message: '已推送，尚未发现对应的 Actions 运行。', workflowUrl };
		let state = run.status === 'completed' ? run.conclusion || 'completed' : run.status;
		let message = run.conclusion || run.status;
		let siteCheck = null;
		if (state === 'success') {
			const paths = [...new Set(['', 'blog/', 'rss.xml', ...publishedSlugs.map((slug) => `blog/${slug}/`)])];
			const checks = await Promise.all(paths.map(async (pathname) => {
				try {
					const response = await fetchImpl(`https://miles-gift.github.io/${pathname}`, { signal: AbortSignal.timeout(5000) });
					return { pathname: `/${pathname}`, ok: response.ok, status: response.status };
				} catch {
					return { pathname: `/${pathname}`, ok: false, status: 0 };
				}
			}));
			const failed = checks.filter((item) => !item.ok);
			siteCheck = { ok: failed.length === 0, checks };
			if (failed.length) {
				state = 'site_check_failed';
				message = `Actions 部署成功，但 ${failed.length} 个线上页面检查未通过。`;
			} else {
				message = `Actions 部署成功，线上检查通过（${checks.length} 个页面）。`;
			}
		}
		return { state, message, workflowUrl: run.html_url || workflowUrl, siteCheck };
	} catch {
		return { state: 'unknown', message: '已推送；GitHub Actions 状态暂时无法查询。', workflowUrl };
	}
}

export async function publishWorkspace(options) {
	const { projectRoot, workspaceRoot, expectedRemote = defaultRemote, onProgress, checkRunner, deploymentStatus = getDeploymentStatus } = options;
	const report = (phase, message) => onProgress?.(phase, message);
	let backupRoot = null;
	let committedSha = '';
	let stagingStarted = false;
	let pathsToRestore = [];
	let selected = [];
	let settingsDocument = null;
	const appliedCurrent = new Map();

	report('preflight', '检查分支、远程仓库和工作区…');
	let branch = await command(['branch', '--show-current'], projectRoot);
	if (branch !== trackedBranch) throw new Error(`当前在 ${branch || '未命名'} 分支；发布只允许推送 origin/main。`);
	const remoteUrl = await command(['remote', 'get-url', 'origin'], projectRoot);
	if (!sameRemote(remoteUrl, expectedRemote)) throw new Error('origin 不是计划中的 Miles-gift/miles-gift.github.io GitHub 仓库。');
	if (await statusOutput(projectRoot)) throw new Error('Git 工作区有其他未提交改动；请先处理后再发布。');

	report('fetching', '读取 origin/main 并检查远端更新…');
	await command(['fetch', 'origin', 'main'], projectRoot);
	const counts = (await command(['rev-list', '--left-right', '--count', 'main...origin/main'], projectRoot)).split(/\s+/).map(Number);
	const [ahead, behind] = counts;
	if (ahead > 0) throw new Error('本地 main 有尚未推送的提交；请先处理这些提交，CMS 不会自动重放或强推。');
	if (behind > 0) {
		try { await command(['merge', '--ff-only', 'origin/main'], projectRoot); }
		catch { throw new Error('origin/main 已更新且无法快进同步。请先手动整合远端变更，再重试。'); }
	}
	if (await statusOutput(projectRoot)) throw new Error('同步 origin/main 后发现工作区改动；已停止发布。');

	report('planning', '核对文章基线、博客设置和图片引用…');
	let inspection = await inspectWorkspace(options);
	if (inspection.blockers.length) throw new Error(inspection.blockers.join('\n'));
	const contentNormalized = await normalizeSelectedPostDocuments(workspaceRoot, inspection.selected);
	const imageMigration = await migrateSelectedPostImages(options, inspection.selected);
	if (imageMigration.blockers.length) throw new Error(imageMigration.blockers.join('\n'));
	if (imageMigration.migrations.length) report('planning', `已将 ${imageMigration.migrations.length} 个图片引用迁移到本地统一媒体库…`);
	if (contentNormalized || imageMigration.migrations.length) inspection = await inspectWorkspace(options);
	if (inspection.blockers.length) throw new Error(inspection.blockers.join('\n'));
	if (inspection.changes.length === 0) throw new Error('没有加入发布清单的改动。');
	selected = inspection.selected;
	settingsDocument = inspection.settingsDocument;
	const changedPaths = new Set(inspection.changes.map((change) => change.path));
	for (const { document } of selected) if (!document.deleted) changedPaths.add(`src/content/blog/${document.slug}.${document.extension}`);
	if (inspection.settingsChange) changedPaths.add('src/data/blog-settings.json');
	for (const filename of inspection.media) {
		const target = path.join(projectRoot, 'public/uploads/blog', filename);
		if (!await safeLstat(target)) changedPaths.add(`public/uploads/blog/${filename}`);
	}
	pathsToRestore = [...changedPaths];
	backupRoot = await prepareBackup(projectRoot, workspaceRoot, pathsToRestore);

	try {
		report('applying', '应用选中的 CMS 内容并复制引用图片…');
		for (const item of selected) {
			const destination = await assertSafePath(projectRoot, item.relativePath);
			if (item.action === 'delete') {
				await rm(destination, { force: true });
				appliedCurrent.set(item.relativePath, null);
			} else {
				await atomicWrite(destination, item.document.content);
				appliedCurrent.set(item.relativePath, hashContent(item.document.content));
			}
		}
		if (inspection.settingsChange) {
			const destination = await assertSafePath(projectRoot, 'src/data/blog-settings.json');
			const serialized = `${JSON.stringify(settingsDocument.settings, null, 2)}\n`;
			await atomicWrite(destination, serialized);
			appliedCurrent.set('src/data/blog-settings.json', hashContent(serialized));
		}
		for (const filename of inspection.media) {
			const target = await assertSafePath(projectRoot, `public/uploads/blog/${filename}`);
			const source = await assertSafePath(workspaceRoot, `media/${filename}`, { allowMissing: false });
			const info = await lstat(source);
			if (!info.isFile() || info.isSymbolicLink()) throw new Error(`上传图片不是普通文件：${filename}`);
			const bytes = await readFile(source);
			const existing = await safeLstat(target);
			if (existing) {
				if (!existing.isFile() || existing.isSymbolicLink() || hashContent(await readFile(target)) !== hashContent(bytes)) {
					throw new Error(`公开媒体文件名已被占用：${filename}`);
				}
			} else {
				await atomicWrite(target, bytes);
			}
			if (pathsToRestore.includes(`public/uploads/blog/${filename}`)) appliedCurrent.set(`public/uploads/blog/${filename}`, hashContent(bytes));
		}

		const expected = new Set(pathsToRestore);
		const working = (await statusOutput(projectRoot))
			.split('\n').filter(Boolean).map((line) => line.slice(3));
		const unexpected = working.filter((file) => !expected.has(file));
		if (unexpected.length) throw new Error(`发现 CMS 清单之外的工作区文件，已取消发布：${unexpected.join('、')}`);
		for (const [relativePath, expectedHash] of appliedCurrent) {
			const target = await assertSafePath(projectRoot, relativePath);
			const info = await safeLstat(target);
			const matches = expectedHash === null
				? !info
				: Boolean(info?.isFile() && !info.isSymbolicLink() && hashContent(await readFile(target)) === expectedHash);
			if (!matches) throw new Error(`CMS 发布期间文件被其他操作改动，已停止提交：${relativePath}`);
		}

		report('checking', '运行 frontmatter、类型、测试和生产构建检查…');
		await runChecks(projectRoot, report, checkRunner);
		const addPaths = [...expected];
		stagingStarted = true;
		await command(['add', '--', ...addPaths], projectRoot);
		const staged = (await command(['diff', '--cached', '--name-only'], projectRoot)).split('\n').filter(Boolean);
		const outside = staged.filter((file) => !expected.has(file));
		if (outside.length) throw new Error(`暂存区出现非 CMS 文件，已取消发布：${outside.join('、')}`);
		if (!staged.length) throw new Error('检查完成，但没有文件变化可提交。');
		await command(['diff', '--cached', '--check'], projectRoot);

		report('committing', '仅提交 CMS 管理的文章、设置和图片…');
		const names = [...new Set(selected.map((item) => item.document.slug))].slice(0, 4);
		const subject = names.length ? `content: update ${names.join(', ')}` : 'content: update blog settings';
		await publishCommand('git', ['commit', '-m', subject], projectRoot);
		committedSha = await command(['rev-parse', 'HEAD'], projectRoot);
		report('pushing', `推送提交 ${committedSha.slice(0, 12)} 到 origin/main…`);
		try {
			await command(['push', 'origin', 'main'], projectRoot);
		} catch (error) {
			return {
				ok: false, state: 'push_failed', commitSha: committedSha,
				message: `本地提交已创建，但 GitHub 拒绝或无法接收推送。没有强推；请保留提交并先同步远端。\n${error.message}`,
				backupRoot,
			};
		}

		report('pushed', '已推送到 GitHub；正在查询 Actions 状态…');
		let archiveWarning = '';
		try { await archiveWorkspace(workspaceRoot, selected, settingsDocument, committedSha); }
		catch (error) { archiveWarning = `本机草稿归档未完成，仍可从 ${backupRoot} 恢复：${error.message}`; }
		const slugs = selected.filter((item) => item.action === 'write').map((item) => item.document.slug);
		const deployment = await deploymentStatus(committedSha, fetch, slugs);
		report('pushed', 'Git push 已完成，正在等待 GitHub Actions 与线上检查。');
		return { ok: true, state: 'pushed', commitSha: committedSha, message: archiveWarning || '已推送到 origin/main。', workflow: deployment, backupRoot, slugs };
	} catch (error) {
		if (!committedSha && backupRoot) {
			try {
				const restoreConflicts = await restoreBackup(projectRoot, backupRoot, appliedCurrent);
				if (stagingStarted) {
					const staged = (await command(['diff', '--cached', '--name-only'], projectRoot)).split('\n').filter((file) => pathsToRestore.includes(file) && !restoreConflicts.includes(file));
					if (staged.length) await command(['restore', '--staged', '--', ...staged], projectRoot);
				}
				if (restoreConflicts.length) throw new Error(`以下文件在发布过程中被其他操作修改，保留了当前内容，请手动核对：${restoreConflicts.join('、')}`);
			} catch (rollbackError) {
				throw new Error(`${error.message}\n自动还原也失败，请从 ${backupRoot} 恢复：${rollbackError.message}`);
			}
		}
		throw error;
	}
}
