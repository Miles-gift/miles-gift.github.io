import { describe, expect, it } from 'vitest';
import { parsePostSource, serializePostSource } from '../../../tools/local-cms/content.mjs';

const source = [
	'---',
	'title: "CMS round trip"',
	'date: "2026-09-26T10:30:00+08:00"',
	'updated: "2026-09-26T11:45:00+08:00"',
	'description: "摘要保留"',
	'draft: false',
	'categories:',
	'  - "知识管理"',
	'tags:',
	'  - "Markdown"',
	'  - "数字花园"',
	'---',
	'',
	'## 正文段落',
	'',
	'原始 **Markdown** 正文。',
	'',
].join('\n');

describe('local CMS article serialization', () => {
	it('preserves the Markdown body and round-trips Shanghai dates and fields', () => {
		const parsed = parsePostSource(source);
		const roundTrip = serializePostSource({ ...parsed.data, lineEnding: parsed.lineEnding }, parsed.body);
		const reparsed = parsePostSource(roundTrip.content);

		expect(reparsed.body).toBe(parsed.body);
		expect(reparsed.data.title).toBe('CMS round trip');
		expect(reparsed.data.date).toBe('2026-09-26T10:30');
		expect(reparsed.data.updated).toBe('2026-09-26T11:45');
		expect(reparsed.data.tags).toEqual(['markdown', '数字花园']);
	});

	it('accepts a private incomplete draft while requiring metadata for a public post', () => {
		const draft = serializePostSource({
			title: '本地草稿', date: '2026-09-26T12:00', draft: true, categories: [], tags: [],
		}, '\n正文。');
		expect(parsePostSource(draft.content).data.categories).toEqual([]);
		expect(parsePostSource(draft.content).data.tags).toEqual([]);
		expect(() => serializePostSource({
			title: '正式文章', date: '2026-09-26T12:00', draft: false, categories: [], tags: [],
		}, '\n正文。')).toThrow(/分类/);
	});

	it('rejects external cover paths', () => {
		expect(() => serializePostSource({
			title: '封面路径检查', date: '2026-09-26T12:00', draft: true, categories: [], tags: [],
			cover: 'https://example.com/cover.webp',
		}, '\n正文。')).toThrow(/封面/);
		expect(() => serializePostSource({
			title: '越界封面路径', date: '2026-09-26T12:00', draft: true, categories: [], tags: [],
			cover: '/uploads/blog/../private.webp',
		}, '\n正文。')).toThrow(/封面/);
		expect(() => serializePostSource({
			title: '本地封面', date: '2026-09-26T12:00', draft: true, categories: [], tags: [],
			cover: '/uploads/blog/cover.webp',
		}, '\n正文。')).not.toThrow();
	});
});
