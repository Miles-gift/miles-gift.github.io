import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateBlogSettings } from '../../../tools/local-cms/settings.mjs';

const defaults = JSON.parse(await readFile(new URL('../../data/blog-settings.json', import.meta.url), 'utf8'));

describe('local CMS blog settings validation', () => {
	it('accepts the site defaults and dynamic archive values', () => {
		expect(validateBlogSettings(defaults).archiveIntro).toContain('{total}');
	});

	it('rejects unknown placeholders and external image URLs', () => {
		expect(() => validateBlogSettings({ ...defaults, archiveIntro: '共 {posts} 篇' })).toThrow(/占位符/);
		expect(() => validateBlogSettings({
			...defaults,
			blogHero: { ...defaults.blogHero, backgroundImage: 'https://example.com/hero.jpg' },
		})).toThrow(/站内图片路径/);
	});
});
