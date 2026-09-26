import { execFileSync } from 'node:child_process';
import { chmod } from 'node:fs/promises';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { hashContent, serializePostSource } from '../../../tools/local-cms/content.mjs';
import { getPublishSummary, publishWorkspace } from '../../../tools/local-cms/publish.mjs';
import { saveSettingsDocument } from '../../../tools/local-cms/settings.mjs';

const tempRoots: string[] = [];

async function fixture() {
	const root = await mkdtemp(path.join(os.tmpdir(), 'cms-publish-test-'));
	tempRoots.push(root);
	const projectRoot = path.join(root, 'repo');
	const workspaceRoot = path.join(root, 'private-cms');
	const postRoot = path.join(projectRoot, 'src/content/blog');
	const settingsPath = path.join(projectRoot, 'src/data/blog-settings.json');
	const remotePath = path.join(root, 'origin.git');
	const run = (args: string[], cwd = projectRoot) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
	await mkdir(postRoot, { recursive: true });
	await mkdir(path.dirname(settingsPath), { recursive: true });
	await mkdir(path.join(workspaceRoot, 'drafts'), { recursive: true });
	const settings = JSON.parse(await readFile(new URL('../../data/blog-settings.json', import.meta.url), 'utf8'));
	await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
	const original = serializePostSource({
		title: '初始文章', date: '2026-09-26T10:00', draft: false, categories: ['测试'], tags: ['test'],
	}, '\n初始正文。').content;
	await writeFile(path.join(postRoot, 'existing.md'), original);
	run(['init', '--initial-branch=main']);
	run(['config', 'user.name', 'CMS Test']);
	run(['config', 'user.email', 'cms-test@example.invalid']);
	run(['add', '--all']);
	run(['commit', '-m', 'initial']);
	execFileSync('git', ['init', '--bare', remotePath], { encoding: 'utf8', stdio: 'ignore' });
	run(['remote', 'add', 'origin', remotePath]);
	run(['push', '-u', 'origin', 'main']);
	const baseHead = run(['rev-parse', 'HEAD']);
	const update = serializePostSource({
		title: '更新后的文章', date: '2026-09-26T10:00', draft: false, categories: ['测试'], tags: ['test'],
		cover: '/uploads/blog/0123456789abcdefabcd.webp',
	}, '\n更新正文。\n\n![图](/uploads/blog/0123456789abcdefabcd.webp)').content;
	const document = {
		version: 1,
		slug: 'existing',
		extension: 'md',
		sourceExists: true,
		baseHead,
		baseHash: hashContent(original),
		baseContent: original,
		lineEnding: '\n',
		content: update,
		deleted: false,
		readyToPublish: true,
		savedAt: new Date().toISOString(),
	};
	await writeFile(path.join(workspaceRoot, 'drafts/existing.json'), JSON.stringify(document));
	await mkdir(path.join(workspaceRoot, 'media'), { recursive: true });
	await writeFile(path.join(workspaceRoot, 'media/0123456789abcdefabcd.webp'), Buffer.from('test-webp-payload'));
	return { root, projectRoot, workspaceRoot, postRoot, settingsPath, remotePath, run, original, update, document };
}

afterEach(async () => {
	await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('local CMS publish transaction', () => {
	it('publishes only selected article and referenced image paths to main', async () => {
		const state = await fixture();
		const settings = JSON.parse(await readFile(state.settingsPath, 'utf8'));
		settings.archiveTitle = '测试新归档标题';
		await saveSettingsDocument(state.workspaceRoot, state.settingsPath, settings, state.document.baseHead);
		const summary = await getPublishSummary({ ...state, expectedRemote: state.remotePath });
		expect(summary.canPublish).toBe(true);
		expect(summary.changes.map((item: { path: string }) => item.path).sort()).toEqual([
			'public/uploads/blog/0123456789abcdefabcd.webp',
			'src/content/blog/existing.md',
			'src/data/blog-settings.json',
		]);
		const checks: string[] = [];
		const result = await publishWorkspace({
			...state,
			expectedRemote: state.remotePath,
			checkRunner: (_command: string, args: string[]) => { checks.push(args.join(' ')); return ''; },
			deploymentStatus: async () => ({ state: 'waiting', message: 'queued', workflowUrl: 'https://github.com/example/actions' }),
		});
		expect(result.ok).toBe(true);
		expect(checks).toHaveLength(4);
		expect(await readFile(path.join(state.projectRoot, 'src/content/blog/existing.md'), 'utf8')).toBe(state.update);
		expect(JSON.parse(await readFile(state.settingsPath, 'utf8')).archiveTitle).toBe('测试新归档标题');
		expect(await readFile(path.join(state.projectRoot, 'public/uploads/blog/0123456789abcdefabcd.webp'), 'utf8')).toBe('test-webp-payload');
		expect(state.run(['diff', '--name-only', 'origin/main..main'])).toBe('');
		expect(state.run(['show', '--pretty=format:', '--name-only', 'HEAD']).split('\n').filter(Boolean).sort()).toEqual([
			'public/uploads/blog/0123456789abcdefabcd.webp',
			'src/content/blog/existing.md',
			'src/data/blog-settings.json',
		]);
		expect(await readFile(path.join(state.workspaceRoot, 'archive', result.commitSha.slice(0, 12), 'drafts/existing.json'), 'utf8')).toContain('更新后的文章');
	});

	it('restores public files and leaves workspace drafts when validation fails', async () => {
		const state = await fixture();
		const headBefore = state.run(['rev-parse', 'HEAD']);
		await expect(publishWorkspace({
			...state,
			expectedRemote: state.remotePath,
			checkRunner: (_command: string, args: string[]) => {
				if (args.includes('build')) throw new Error('simulated build failure');
				return '';
			},
		})).rejects.toThrow(/npm run build 失败/);
		expect(state.run(['rev-parse', 'HEAD'])).toBe(headBefore);
		expect(await readFile(path.join(state.postRoot, 'existing.md'), 'utf8')).toBe(state.original);
		expect(await readFile(path.join(state.workspaceRoot, 'drafts/existing.json'), 'utf8')).toContain('更新后的文章');
		expect(state.run(['status', '--porcelain'])).toBe('');
	});

	it('blocks a changed source file instead of overwriting it', async () => {
		const state = await fixture();
		await writeFile(path.join(state.postRoot, 'existing.md'), `${state.original}\n手工并行改动。`);
		const summary = await getPublishSummary({ ...state, expectedRemote: state.remotePath });
		expect(summary.canPublish).toBe(false);
		expect(summary.blockers.join('\n')).toMatch(/源文件已变化/);
	});

	it('fast-forwards an unrelated origin/main update before publishing', async () => {
		const state = await fixture();
		const writer = path.join(state.root, 'remote-writer');
		execFileSync('git', ['clone', state.remotePath, writer], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
		const write = (args: string[]) => execFileSync('git', args, { cwd: writer, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
		write(['config', 'user.name', 'Remote Writer']);
		write(['config', 'user.email', 'remote@example.invalid']);
		await writeFile(path.join(writer, 'remote-note.txt'), 'unrelated remote update\n');
		write(['add', 'remote-note.txt']);
		write(['commit', '-m', 'remote update']);
		write(['push', 'origin', 'main']);
		const result = await publishWorkspace({
			...state,
			expectedRemote: state.remotePath,
			checkRunner: () => '',
			deploymentStatus: async () => ({ state: 'waiting', message: 'queued', workflowUrl: 'https://github.com/example/actions' }),
		});
		expect(result.ok).toBe(true);
		expect(await readFile(path.join(state.projectRoot, 'remote-note.txt'), 'utf8')).toBe('unrelated remote update\n');
		expect(state.run(['diff', '--name-only', 'origin/main..main'])).toBe('');
	});

	it('does not overwrite another uncommitted file', async () => {
		const state = await fixture();
		await writeFile(path.join(state.projectRoot, 'private-note.txt'), 'keep this local');
		await expect(publishWorkspace({ ...state, expectedRemote: state.remotePath, checkRunner: () => '' })).rejects.toThrow(/未提交改动/);
		expect(await readFile(path.join(state.projectRoot, 'private-note.txt'), 'utf8')).toBe('keep this local');
		expect(await readFile(path.join(state.postRoot, 'existing.md'), 'utf8')).toBe(state.original);
	});

	it('keeps the local commit and workspace when the remote rejects a push', async () => {
		const state = await fixture();
		const hook = path.join(state.remotePath, 'hooks/pre-receive');
		await writeFile(hook, '#!/bin/sh\nexit 1\n');
		await chmod(hook, 0o755);
		const result = await publishWorkspace({
			...state,
			expectedRemote: state.remotePath,
			checkRunner: () => '',
			deploymentStatus: async () => ({ state: 'waiting', message: 'queued', workflowUrl: 'https://github.com/example/actions' }),
		});
		expect(result.ok).toBe(false);
		expect(result.state).toBe('push_failed');
		expect(state.run(['rev-parse', 'HEAD'])).not.toBe(state.document.baseHead);
		expect(await readFile(path.join(state.workspaceRoot, 'drafts/existing.json'), 'utf8')).toContain('更新后的文章');
		expect(state.run(['status', '--porcelain'])).toBe('');
	});

	it('publishes a requested deletion as one exact Git removal', async () => {
		const state = await fixture();
		const document = { ...state.document, deleted: true, readyToPublish: false };
		await writeFile(path.join(state.workspaceRoot, 'drafts/existing.json'), JSON.stringify(document));
		const result = await publishWorkspace({
			...state,
			expectedRemote: state.remotePath,
			checkRunner: () => '',
			deploymentStatus: async () => ({ state: 'waiting', message: 'queued', workflowUrl: 'https://github.com/example/actions' }),
		});
		expect(result.ok).toBe(true);
		expect(state.run(['show', '--pretty=format:', '--name-status', 'HEAD'])).toContain('D\tsrc/content/blog/existing.md');
	});
});
