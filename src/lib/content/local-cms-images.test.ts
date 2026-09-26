import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { serializePostSource } from '../../../tools/local-cms/content.mjs';
import { findImageReferences, rewriteImageReferences } from '../../../tools/local-cms/image-references.mjs';
import { migrateSelectedPostImages } from '../../../tools/local-cms/image-migration.mjs';
import { readWorkspaceDocument, saveWorkspaceDocument } from '../../../tools/local-cms/workspace.mjs';

const roots: string[] = [];

async function fixture() {
	const root = await mkdtemp(path.join(os.tmpdir(), 'cms-images-test-'));
	roots.push(root);
	const projectRoot = path.join(root, 'repo');
	const workspaceRoot = path.join(root, 'private-cms');
	const postRoot = path.join(projectRoot, 'src/content/blog');
	await mkdir(postRoot, { recursive: true });
	await mkdir(path.join(projectRoot, 'public/images'), { recursive: true });
	await mkdir(path.join(workspaceRoot, 'drafts'), { recursive: true });
	return { projectRoot, workspaceRoot, postRoot };
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('local CMS image references', () => {
	it('finds Markdown, reference-style, HTML, and frontmatter cover images while ignoring code blocks', () => {
		const source = serializePostSource({
			title: '图片检查', date: '2026-09-26T10:00', draft: false, categories: ['测试'], tags: ['test'], cover: './cover.png',
		}, [
			'![Markdown 图](./images/a.png "说明")',
			'![引用图][diagram]',
			'',
			'<img src="/images/photo.png" alt="photo">',
			'',
			'```md',
			'![代码示例](./not-an-image.png)',
			'```',
			'',
			'[diagram]: ./images/diagram.png',
		].join('\n')).content;
		const references = findImageReferences(source);
		expect(references.map((reference) => reference.url)).toEqual([
			'./cover.png', './images/a.png', './images/diagram.png', '/images/photo.png',
		]);
		expect(references[0].kind).toBe('cover');
		expect(references.at(-1)?.line).toBeGreaterThan(10);
	});

	it('rewrites a reference-style image to a managed URL without changing surrounding content', () => {
		const source = serializePostSource({ title: '引用', date: '2026-09-26T10:00', draft: false, categories: ['测试'], tags: ['test'] }, '\n![alt][pic]\n\n[pic]: ./img.png').content;
		const refs = findImageReferences(source);
		const output = rewriteImageReferences(source, refs, refs.map((ref) => ref.kind === 'markdown' ? '/uploads/blog/aaaaaaaaaaaaaaaaaaaa.png' : null));
		expect(output).toContain('![alt](</uploads/blog/aaaaaaaaaaaaaaaaaaaa.png>)');
		expect(output).toContain('[pic]: ./img.png');
	});

	it('archives existing relative and root-relative files, rewrites the article, and deduplicates identical assets', async () => {
		const { projectRoot, workspaceRoot, postRoot } = await fixture();
		const image = await sharp({ create: { width: 3, height: 2, channels: 3, background: '#ff8800' } }).png().toBuffer();
		await mkdir(path.join(postRoot, 'images'), { recursive: true });
		await writeFile(path.join(postRoot, 'images', 'chart.png'), image);
		await writeFile(path.join(projectRoot, 'public/images/photo.png'), image);
		const content = serializePostSource({ title: '可迁移文章', date: '2026-09-26T10:00', draft: false, categories: ['测试'], tags: ['test'] }, '\n![图表](images/chart.png)\n\n<img src="/images/photo.png">').content;
		const document = { version: 1, slug: 'article', extension: 'md', sourceExists: false, content, deleted: false, readyToPublish: true, savedAt: new Date().toISOString() };
		await saveWorkspaceDocument(workspaceRoot, document);
		const result = await migrateSelectedPostImages({ projectRoot, workspaceRoot }, [{ document, action: 'write', relativePath: 'src/content/blog/article.md' }]);
		const saved = await readWorkspaceDocument(workspaceRoot, 'article');
		expect(result.blockers).toEqual([]);
		expect(result.migrations).toHaveLength(2);
		expect(result.migrations[0].to).toBe(result.migrations[1].to);
		expect(saved?.content).toContain(`![图表](<${result.migrations[0].to}>)`);
		expect(saved?.content).toContain(`<img src="${result.migrations[1].to}">`);
		expect(await readFile(path.join(workspaceRoot, 'media', path.basename(result.migrations[0].to)))).toEqual(image);
	});

	it('blocks a missing image with the article and original path', async () => {
		const { projectRoot, workspaceRoot } = await fixture();
		const content = serializePostSource({ title: '缺图文章', date: '2026-09-26T10:00', draft: false, categories: ['测试'], tags: ['test'] }, '\n![坏图](./missing/file.png)').content;
		const document = { version: 1, slug: 'broken', extension: 'md', sourceExists: false, content, deleted: false, readyToPublish: true, savedAt: new Date().toISOString() };
		const result = await migrateSelectedPostImages({ projectRoot, workspaceRoot }, [{ document, action: 'write', relativePath: 'src/content/blog/broken.md' }]);
		expect(result.blockers).toHaveLength(1);
		expect(result.blockers[0]).toContain('缺图文章');
		expect(result.blockers[0]).toContain('./missing/file.png');
		expect(result.blockers[0]).toContain('src/content/blog/missing/file.png');
	});
});
