import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readFriendLinksDocument, saveFriendLinksDocument, validateFriendLinks } from '../../../tools/local-cms/friend-links.mjs';

const source = new URL('../../data/friend-links.json', import.meta.url);
const initial = JSON.parse(await readFile(source, 'utf8'));
const roots: string[] = [];

async function workspace() {
	const root = await mkdtemp(path.join(tmpdir(), 'friend-links-test-'));
	roots.push(root);
	return root;
}

afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe('友联数据与本地 CMS 文档', () => {
	it('接受公开种子数据并规范化安全网址', () => {
		expect(validateFriendLinks(initial).links.map((link: { url: string }) => link.url)).toEqual([
			'https://motues.top/', 'https://zgzlcc.github.io/',
		]);
	});

	it('拒绝不安全、重复或超长数据', () => {
		const link = initial.links[0];
		expect(() => validateFriendLinks({ ...initial, links: [{ ...link, url: 'javascript:alert(1)' }] })).toThrow(/HTTP 或 HTTPS/);
		expect(() => validateFriendLinks({ ...initial, links: [link, { ...link, id: 'duplicate' }] })).toThrow(/重复/);
		expect(() => validateFriendLinks({ ...initial, links: [{ ...link, name: ' ' }] })).toThrow(/名称必填/);
		expect(() => validateFriendLinks({ ...initial, links: [{ ...link, avatar: 'javascript:alert(1)' }] })).toThrow(/头像只接受/);
		expect(validateFriendLinks({ ...initial, links: [{ ...link, avatar: 'https://cdn.example.org/avatar.webp' }] }).links[0].avatar).toBe('https://cdn.example.org/avatar.webp');
	});

	it('只保存到本机，并拒绝旧 revision 覆盖', async () => {
		const root = await workspace();
		const first = await readFriendLinksDocument(root, source.pathname);
		const changed = { version: 1, links: [...first.data.links, { id: 'third', name: 'Example', url: 'https://example.org/', description: '', enabled: true }] };
		const saved = await saveFriendLinksDocument(root, source.pathname, changed, first.revision);
		expect(saved.local).toBe(true);
		expect((await readFile(source, 'utf8'))).toContain('Motues');
		await expect(saveFriendLinksDocument(root, source.pathname, first.data, first.revision)).rejects.toMatchObject({ status: 409 });
		expect((await readFriendLinksDocument(root, source.pathname)).data.links).toHaveLength(3);
	});
});
