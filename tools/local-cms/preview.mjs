import { spawn } from 'node:child_process';
import { cp, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { listWorkspaceDocuments } from './workspace.mjs';
import { readSettingsDocument } from './settings.mjs';

async function unusedPort() {
	const socket = createServer();
	await new Promise((resolve, reject) => socket.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve()));
	const { port } = socket.address();
	await new Promise((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
	return port;
}

export function createPreviewManager({ projectRoot, workspaceRoot, postRoot, settingsPath }) {
	let active = null;

	async function cleanupStale() {
		for (const name of await readdir(tmpdir())) {
			if (!name.startsWith('ulbo-local-cms-preview-')) continue;
			const root = path.join(tmpdir(), name);
			try {
				const marker = JSON.parse(await readFile(path.join(root, '.owner.json'), 'utf8'));
				if (marker.projectRoot !== projectRoot || !Number.isInteger(marker.pid) || marker.pid === process.pid) continue;
				let alive = true;
				try { process.kill(marker.pid, 0); } catch (error) { alive = error.code === 'EPERM'; }
				if (!alive) await rm(root, { recursive: true, force: true });
			} catch (error) {
				if (error.code === 'ENOENT') continue;
				throw error;
			}
		}
	}

	async function stop() {
		const current = active;
		active = null;
		if (!current) return;
		if (current.child.exitCode === null && !current.child.killed) {
			current.child.kill('SIGTERM');
			await Promise.race([current.exited, delay(3000)]);
			if (current.child.exitCode === null) current.child.kill('SIGKILL');
		}
		await rm(current.root, { recursive: true, force: true });
	}

	async function start(pathname) {
		if (!/^\/blog\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?$/.test(pathname)) {
			throw Object.assign(new Error('预览地址只支持博客列表或单篇博客。'), { status: 400 });
		}
		await stop();
		await cleanupStale();
		await mkdir(workspaceRoot, { recursive: true, mode: 0o700 });
		const baseInfo = await lstat(workspaceRoot);
		if (!baseInfo.isDirectory() || baseInfo.isSymbolicLink()) throw new Error('本机工作区不能是符号链接或普通文件。');
		const root = await mkdtemp(path.join(tmpdir(), 'ulbo-local-cms-preview-'));
		await writeFile(path.join(root, '.owner.json'), JSON.stringify({ projectRoot, pid: process.pid }), { mode: 0o600 });
		const snapshotRoot = path.join(root, 'project');
		await mkdir(snapshotRoot, { mode: 0o700 });
		try {
			const skipped = new Set(['.git', '.local-cms', 'node_modules', 'dist', '.astro', 'coverage']);
			await cp(projectRoot, snapshotRoot, {
				recursive: true,
				filter: (source) => {
					const relative = path.relative(projectRoot, source);
					return relative === '' || !skipped.has(relative.split(path.sep)[0]);
				},
			});
			const sourceModules = path.join(projectRoot, 'node_modules');
			await cp(sourceModules, path.join(snapshotRoot, 'node_modules'), {
				recursive: true,
				filter: (source) => {
					const relative = path.relative(sourceModules, source);
					return relative === '' || !new Set(['.vite', '.astro']).has(relative.split(path.sep)[0]);
				},
			});

			const postDirectory = path.join(snapshotRoot, path.relative(projectRoot, postRoot));
			const documents = await listWorkspaceDocuments(workspaceRoot);
			for (const document of documents) {
				const destination = path.join(postDirectory, `${document.slug}.${document.extension}`);
				if (document.deleted) {
					await rm(destination, { force: true });
					continue;
				}
				await writeFile(destination, document.content, { encoding: 'utf8', mode: 0o600 });
			}

			const mediaSource = path.join(workspaceRoot, 'media');
			try {
				const mediaInfo = await lstat(mediaSource);
				if (!mediaInfo.isDirectory() || mediaInfo.isSymbolicLink()) throw new Error('本机媒体目录不能是符号链接。');
				const destination = path.join(snapshotRoot, 'public/uploads/blog');
				await mkdir(destination, { recursive: true });
				for (const name of await readdir(mediaSource)) {
					if (!/^[a-f0-9]{20}\.webp$/.test(name)) continue;
					const info = await lstat(path.join(mediaSource, name));
					if (info.isFile() && !info.isSymbolicLink()) await cp(path.join(mediaSource, name), path.join(destination, name));
				}
			} catch (error) {
				if (error.code !== 'ENOENT') throw error;
			}

			const settings = await readSettingsDocument(workspaceRoot, settingsPath);
			if (settings.local) {
				await writeFile(path.join(snapshotRoot, path.relative(projectRoot, settingsPath)), `${JSON.stringify(settings.settings, null, 2)}\n`, 'utf8');
			}
			if (pathname !== '/blog/') {
				const slug = pathname.split('/')[2];
				const filename = (await readdir(postDirectory)).find((name) => name === `${slug}.md` || name === `${slug}.mdx`);
				if (!filename) throw Object.assign(new Error('预览文章不存在或已标记删除。'), { status: 404 });
			}

			const port = await unusedPort();
			const astroCli = path.join(snapshotRoot, 'node_modules/astro/bin/astro.mjs');
			const child = spawn(process.execPath, [astroCli, 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
				cwd: snapshotRoot,
				stdio: ['ignore', 'pipe', 'pipe'],
				env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
			});
			let output = '';
			for (const stream of [child.stdout, child.stderr]) stream.setEncoding('utf8').on('data', (chunk) => { output = `${output}${chunk}`.slice(-5000); });
			const exited = new Promise((resolve) => child.once('exit', resolve));
			active = { child, exited, root, port };
			const deadline = Date.now() + 75_000;
			while (Date.now() < deadline) {
				if (child.exitCode !== null) throw new Error(`Astro 本地预览启动失败：${output.slice(-1800)}`);
				try {
					const response = await fetch(`http://127.0.0.1:${port}/blog/`, { signal: AbortSignal.timeout(1200) });
					if (response.ok) return { url: `http://127.0.0.1:${port}${pathname}`, port };
				} catch { /* Astro 正在启动。 */ }
				await delay(300);
			}
			throw new Error(`等待 Astro 预览超时：${output.slice(-1800)}`);
		} catch (error) {
			await rm(root, { recursive: true, force: true });
			if (active?.root === root) await stop();
			throw error;
		}
	}

	function cleanupSync() {
		if (!active) return;
		if (active.child.exitCode === null && !active.child.killed) active.child.kill('SIGTERM');
		rmSync(active.root, { recursive: true, force: true });
		active = null;
	}

	return { start, stop, cleanupSync };
}
