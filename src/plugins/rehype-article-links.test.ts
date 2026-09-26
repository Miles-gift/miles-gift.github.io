import { describe, expect, it } from 'vitest';
import { rehypeArticleLinks } from './rehype-article-links.mjs';

function link(href: string, children: any[], properties: Record<string, unknown> = {}) {
	return {
		type: 'element',
		tagName: 'a',
		properties: { href, ...properties },
		children,
	};
}

function text(value: string) {
	return { type: 'text', value };
}

function run(...links: any[]) {
	const tree = { type: 'root', children: links };
	rehypeArticleLinks({ siteUrl: 'https://blog.example/' })(tree);
	return tree.children;
}

describe('rehypeArticleLinks', () => {
	it('marks only links that resolve outside the configured site origin', () => {
		const [relative, sameOrigin, external, protocolRelative, anchor, email] = run(
			link('/notes/reading', [text('relative')]),
			link('https://blog.example/notes/reading', [text('same origin')]),
			link('https://docs.example/guide', [text('external')]),
			link('//docs.example/guide', [text('protocol relative')]),
			link('#section', [text('same page')]),
			link('mailto:hello@example.com', [text('email')]),
		);

		expect(relative.properties.className).toBeUndefined();
		expect(sameOrigin.properties.className).toBeUndefined();
		expect(external.properties.className).toContain('article-link--external');
		expect(external.children.at(-1)).toMatchObject({
			type: 'element',
			tagName: 'svg',
			properties: {
				className: ['article-link__outbound-mark'],
				ariaHidden: 'true',
			},
		});
		expect(protocolRelative.properties.className).toContain('article-link--external');
		expect(anchor.properties.className).toBeUndefined();
		expect(email.properties.className).toBeUndefined();
	});

	it('keeps image and download links undecorated and secures explicit new tabs', () => {
		const [newTab, download, image] = run(
			link('https://docs.example/guide', [text('external')], { target: '_blank', rel: ['nofollow'] }),
			link('https://docs.example/file.pdf', [text('download')], { download: '' }),
			link('https://images.example/photo.jpg', [{ type: 'element', tagName: 'img', properties: {}, children: [] }]),
		);

		expect(newTab.properties.rel).toEqual(['nofollow', 'noopener', 'noreferrer']);
		expect(newTab.children.at(-1).tagName).toBe('svg');
		expect(download.properties.className).toContain('article-link--download');
		expect(download.children).toEqual([text('download')]);
		expect(image.properties.className).toContain('article-link--external');
		expect(image.children).toHaveLength(1);
	});
});
